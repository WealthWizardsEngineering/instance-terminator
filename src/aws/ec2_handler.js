'use strict';

const AWS = require('aws-sdk');

module.exports = {
    lookupOldestInstance
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