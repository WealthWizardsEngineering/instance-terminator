'use strict';

const AWS = require('aws-sdk');

module.exports = {
    findAutoscalingGroupsByTag,
    terminateInstance
}

function findAutoscalingGroupsByTag(tagKey, tagValue) {
    return new Promise(function(resolve, reject) {
        const autoscaling = new AWS.AutoScaling();
        autoscaling.describeAutoScalingGroups({}, function(err, data) {
            if (err) {
                reject(err);
            } else {
                const matchingAutoscalingGroups = data['AutoScalingGroups'].filter(item => containsTagValue(item['Tags'], tagKey, tagValue));
                resolve(matchingAutoscalingGroups);
            }
        });
    });
}

function terminateInstance(instanceId) {
    console.log('Terminating instance: ' + instanceId);
    const autoscaling = new AWS.AutoScaling();

    autoscaling.terminateInstanceInAutoScalingGroup({InstanceId: instanceId, ShouldDecrementDesiredCapacity: false}, function(err, data) {
        if (err) {
            console.log(err, err.stack);
        }
    });
}

function containsTagValue(tags, tagKey, tagValue) {
    return tags.some(function (tag) {
        if (tag['Key'] == tagKey && tag['Value'] == tagValue)
            return true;
    })
}