'use strict';

var AWS = require('aws-sdk');

exports.handler = ( event, context, callback ) => {
    console.log("Started");

    var tagKey = 'can-be-terminated'
    var tagValue = 'true'

    getAutoscalingGroups(tagKey, tagValue)
        .then(function(autoscalingGroups) {
            terminateInstanceFromEachAutoscalingGroupIn(autoscalingGroups)
                .then(function(results) {
                    var result = {
                        terminated_instances: results
                    };
                    callback( null, result );
                }, function(reason) {
                    console.log('Some async call failed:');
                    console.log(' --> ', reason);
                    callback(reason);
                });
        }, function(reason) {
            console.log(reason, reason.stack);
            callback(reason);
        });
};

function getAutoscalingGroups(tagKey, tagValue) {
    return new Promise(function(resolve, reject) {
        const autoscaling = new AWS.AutoScaling();
        autoscaling.describeAutoScalingGroups({}, function(err, data) {
            if (err) {
                reject(err);
            } else {
                const matchingAutoscalingGroups = data['AutoScalingGroups'].filter(item => containsTag(item['Tags'], tagKey, tagValue));
                resolve(matchingAutoscalingGroups);
            }
        });
    });
}

function containsTag(tags, tagKey, tagValue) {
    return tags.some(function (tag) {
        if (tag['Key'] == tagKey && tag['Value'] == tagValue)
            return true;
    })
}

function terminateInstanceFromEachAutoscalingGroupIn(autoscalingGroups){
    var promises = [];
    autoscalingGroups.forEach(function(item) {
        promises.push(new Promise(function(resolve, reject) {
            terminateInstanceIn(item, resolve, reject);
        }));
    })
    return Promise.all(promises);
}

function terminateInstanceIn(autoscalingGroup, resolve, reject) {
    console.log('Attempting to terminate instance from: ' + autoscalingGroup['AutoScalingGroupName']);
    var desiredCapacity = autoscalingGroup['DesiredCapacity'];
    console.log('Autoscaling group is expecting ' + desiredCapacity + ' instances');
    if (desiredCapacity < 2) {
        console.log('Too few instances, ignoring.');
        resolve('none');
    }
    var instances = autoscalingGroup['Instances'];
    const healthyInstances = instances.filter(instance => instance['LifecycleState'] == 'InService' && instance['HealthStatus'] == 'Healthy');

    if (healthyInstances.length < desiredCapacity) {
        console.log('Too few healthy instances, ignoring.')
        resolve('none');
    } else {

        lookupOldestInstance(instances)
            .then(function (oldestInstance) {
                terminateInstance(oldestInstance['InstanceId'])
                resolve(oldestInstance['InstanceId']);
            }).catch(function (error) {
                console.log(error);
            });
    }
}

function lookupOldestInstance(instances) {
    return new Promise(function (resolve, reject) {
        const instanceIds = instances.map(instance => instance['InstanceId']);
        const ec2 = new AWS.EC2();
        ec2.describeInstances({InstanceIds: instanceIds}, function (err, reservations) {
            if (err) {
                console.log(err, err.stack);
                reject(err);
            } else {
                var oldestInstance = findOldestInstanceFrom(reservations)
                resolve(oldestInstance);
            }
        });
    });
}

function findOldestInstanceFrom(reservations) {
    const reducer = (accumulator, currentValue) => accumulator.concat(currentValue['Instances']);
    var instances = reservations['Reservations'].reduce(reducer, []);
    instances.sort(function(a, b) {
        if (a['LaunchTime'] > b['LaunchTime']) return 1;
        if (a['LaunchTime'] < b['LaunchTime']) return -1;
        return 0;
    });
    return instances[0];
}

function terminateInstance(instanceId) {
    console.log('Terminate instance: ' + instanceId);
    const autoscaling = new AWS.AutoScaling();

    autoscaling.terminateInstanceInAutoScalingGroup({InstanceId: instanceId, ShouldDecrementDesiredCapacity: false}, function(err, data) {
        if (err) {
            console.log(err, err.stack);
        }
    });
}