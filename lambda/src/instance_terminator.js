'use strict';

var AWS = require('aws-sdk');

exports.handler = ( event, context, callback ) => {
    console.log("Started");

    var tagKey = 'can-be-terminated'
    var tagValue = 'true'

    /*
    TODO:
    * allow parameters to be overridden
    * collect results and return them/fail (use Promise.all(): https://stackoverflow.com/questions/38426745/how-do-i-return-the-accumulated-results-of-multiple-parallel-asynchronous-func )
     */
    const autoscaling = new AWS.AutoScaling();

    autoscaling.describeAutoScalingGroups({}, function(err, data) {
        if (err) {
            console.log(err, err.stack);
            return callback(null, {success: false});
        } else {
            const matchingAutoscalingGroups = data['AutoScalingGroups'].filter(item => containsTag(item['Tags'], tagKey, tagValue));
            matchingAutoscalingGroups.forEach(item => terminateInstanceIn(item))
        }
    });

    return callback( null, { success: true } );
};

function containsTag(tags, tagKey, tagValue) {
    return tags.some(function (tag) {
        if (tag['Key'] == tagKey && tag['Value'] == tagValue)
            return true;
    })
}

function terminateInstanceIn(autoscalingGroup) {
    console.log('Attempting to terminate instance from: ' + autoscalingGroup['AutoScalingGroupName']);
    var desiredCapacity = autoscalingGroup['DesiredCapacity'];
    console.log('Autoscaling group is expecting ' + desiredCapacity + ' instances');
    if (desiredCapacity < 2) {
        console.log('Too few instances, ignoring.');
        return;
    }
    // Are all instances healthy and is there the right number?
    //const result = words.filter(word => word.length > 6);
    var instances = autoscalingGroup['Instances'];
    const healthyInstances = instances.filter(instance => instance['LifecycleState'] == 'InService' && instance['HealthStatus'] == 'Healthy');

    if (healthyInstances.length < desiredCapacity) {
        console.log('Too few healthy instances, ignoring.')
    } else {

        lookupOldestInstance(instances)
            .then(function (oldestInstance) {
                terminateInstance(oldestInstance['InstanceId'])
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