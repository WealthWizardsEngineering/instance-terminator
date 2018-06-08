'use strict';

const autoscaling_handler = require('./aws/autoscaling_handler');
const ec2_handler = require('./aws/ec2_handler');

exports.handler = ( event, context, callback ) => {
    console.log("Started");

    var tagKey = 'can-be-terminated'
    var tagValue = 'true'

    autoscaling_handler.findAutoscalingGroupsByTag(tagKey, tagValue)
        .then(function(autoscalingGroups) {
            var promises = []

            const ungroupedAutoscalingGroups = autoscalingGroups.filter(item => !containsTag(item['Tags'], 'instance-terminator-group'));
            promises = promises.concat(terminateOldestInstanceFromEach(ungroupedAutoscalingGroups));

            const groupedAutoscalingGroups = autoscalingGroups.filter(item => containsTag(item['Tags'], 'instance-terminator-group'));
            promises = promises.concat(terminateOldestInstanceFromEachGrouped(groupedAutoscalingGroups));

            Promise.all(promises).then(function(values) {
                callback(null, [].concat(values));
            }).catch(function (reason) {
                console.log(reason);
                callback(reason);
            });
        }, function(reason) {
            console.log(reason, reason.stack);
            callback(reason);
        });
};

function terminateOldestInstanceFromEach(autoscalingGroups){
    var promises = [];
    autoscalingGroups.forEach(function(autoscalingGroup) {
        promises.push(terminateOldestInstanceIn(autoscalingGroup));
    })
    return promises;
}

function terminateOldestInstanceIn(autoscalingGroup) {
    return new Promise(function(resolve) {
        const autoscalingGroupName = autoscalingGroup['AutoScalingGroupName'];
        console.log('Attempting to terminate instance from: ' + autoscalingGroupName);
        const desiredCapacity = autoscalingGroup['DesiredCapacity'];
        console.log('Autoscaling group is expecting ' + desiredCapacity + ' instances');
        if (desiredCapacity < 2) {
            console.log('Too few instances, ignoring.');
            var response = {
                autoscalingGroupName: autoscalingGroupName,
                result: 'too few instances in group'
            };
            resolve(response);
            return;
        }

        terminateOldestInstanceFrom([autoscalingGroup])
            .then(function (result) {
                var response = {
                    autoscalingGroupName: autoscalingGroupName,
                    result: result['result'],
                };
                if ('instanceId' in result) {
                    response.instanceId = result['instanceId'];
                }
                resolve(response);
            });
    });
}

function terminateOldestInstanceFromEachGrouped(autoscalingGroups) {
    var promises = [];

    const instanceTerminatorGroupNames = new Set(autoscalingGroups.map(item => item['Tags'].find(tag => tag['Key'] == 'instance-terminator-group')['Value']));

    instanceTerminatorGroupNames.forEach(function(instanceTerminatorGroupName) {
        promises.push(new Promise(function(resolve) {

            const matchingAutoscalingGroups = autoscalingGroups.filter(item => containsTag(item['Tags'], 'instance-terminator-group', instanceTerminatorGroupName));
            console.log('Attempting to terminate instance from: ' + instanceTerminatorGroupName);

            if (matchingAutoscalingGroups.length < 2) {
                console.log('Too few autoscaling groups with instance-terminator-group tag: ' + instanceTerminatorGroupName);
                var response = {
                    instanceTerminatorGroupName: instanceTerminatorGroupName,
                    result: 'instance-terminator-group tag only attached to one autoscaling group'
                };
                resolve(response);
                return;
            }

            terminateOldestInstanceFrom(matchingAutoscalingGroups)
                .then(function (result) {
                    var response = {
                        instanceTerminatorGroupName: instanceTerminatorGroupName,
                        result: result['result'],
                    };
                    if ('instanceId' in result) {
                        response.instanceId = result['instanceId'];
                    }
                    resolve(response);
                });
        }));
    });

    return promises;
}

function terminateOldestInstanceFrom(matchingAutoscalingGroups) {
    return new Promise(function (resolve) {
        var promises = [];

        matchingAutoscalingGroups.forEach(function(autoscalingGroup) {
            const desiredCapacity = autoscalingGroup['DesiredCapacity'];
            console.log('Autoscaling group is expecting ' + desiredCapacity + ' instances');

            const instances = autoscalingGroup['Instances'];
            const healthyInstances = instances.filter(instance => instance['LifecycleState'] == 'InService' && instance['HealthStatus'] == 'Healthy');

            if (healthyInstances.length < desiredCapacity) {
                console.log('Too few healthy instances, ignoring.')
                var response = {
                    result: 'not enough healthy instances in group'
                };
                resolve(response);
                return;
            } else {
                promises.push(new Promise(function(resolve, reject) {
                    ec2_handler.lookupOldestInstance(instances)
                        .then(function (oldestInstance) {
                            resolve(oldestInstance);
                        }).catch(function (error) {
                            console.log(error);
                            reject(error);
                        });
                    }));
            }
        });

        if (promises.length > 0) {
            Promise.all(promises).then(function(values) {
                if (values.length > 1) {
                    var oldestInstances = [].concat(values);
                    ec2_handler.lookupOldestInstance(oldestInstances)
                        .then(function (oldestInstance) {
                            autoscaling_handler.terminateInstance(oldestInstance['InstanceId'])
                            var response = {
                                result: 'instance terminated',
                                instanceId: oldestInstance['InstanceId']
                            };
                            resolve(response);
                            return;
                        }).catch(function (error) {
                        console.log(error);
                    });
                } else {
                    autoscaling_handler.terminateInstance(values[0]['InstanceId'])
                    var response = {
                        result: 'instance terminated',
                        instanceId: values[0]['InstanceId']
                    };
                    resolve(response);
                    return;
                }
            }).catch(function (reason) {
                console.log(reason);
            });
        }
     });
}

/*************************/

function containsTag(tags, tagKey) {
    return tags.some(function (tag) {
        if (tag['Key'] == tagKey)
            return true;
    })
}