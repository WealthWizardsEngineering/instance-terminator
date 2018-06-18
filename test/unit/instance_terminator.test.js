'use strict';

const expect = require( 'chai' ).expect;
const proxyquire = require('proxyquire').noCallThru();
const sinon = require( 'sinon' );

const LambdaTester = require( 'lambda-tester' );

describe( 'instance-terminator', function() {

    it( `should not terminate anything when there are no matching autoscaling groups`, function() {
        const terminateInstance = sinon.spy();
        const lookupOldestInstance = sinon.spy();
        const myLambda = proxyquire( '../../src/instance_terminator', {
            './aws/autoscaling_handler': {
                findAutoscalingGroupsByTag: (tagKey, tagValue) => {
                    expect(tagKey).to.equal('can-be-terminated');
                    expect(tagValue).to.equal('true');
                    return new Promise(function (resolve) {
                        resolve([]);
                    });
                },
                terminateInstance: terminateInstance
            },
            './aws/ec2_handler': {
                lookupOldestInstance: lookupOldestInstance
            },
        });

        return LambdaTester(myLambda.handler)
            .event()
            .expectResult((result) => {
                expect(result).to.have.lengthOf(0);
                expect(lookupOldestInstance.notCalled, 'lookupOldestInstance should not be called').to.be.true;
                expect(terminateInstance.notCalled, 'terminate instance should not be called').to.be.true;
            });
    });

    it( `should not terminate anything when there are too few instances in autoscaling group`, function() {
        const terminateInstance = sinon.spy();
        const lookupOldestInstance = sinon.spy();
        const myLambda = proxyquire( '../../src/instance_terminator', {
            './aws/autoscaling_handler': {
                findAutoscalingGroupsByTag: (tagKey, tagValue) => {
                    expect(tagKey).to.equal('can-be-terminated');
                    expect(tagValue).to.equal('true');
                    return new Promise(function (resolve) {
                        resolve(describeAutoscalingGroupsResponse_withTooFewInstances);
                    });
                },
                terminateInstance: terminateInstance
            },
            './aws/ec2_handler': {
                lookupOldestInstance: lookupOldestInstance
            },
        });

        return LambdaTester(myLambda.handler)
            .event()
            .expectResult((result) => {
                console.log('result:');
                console.log(result);
                expect(result).to.have.lengthOf(1);
                expect(result).to.have.deep.members([{autoscalingGroupName: 'my-asg-1-instance', result: 'too few instances in group'}]);
                expect(lookupOldestInstance.notCalled, 'lookupOldestInstance should not be called').to.be.true;
                expect(terminateInstance.notCalled, 'terminate instance should not be called').to.be.true;
            });
    });

    it( `should not terminate anything when there are unhealthy instances in autoscaling group`, function() {
        const terminateInstance = sinon.spy();
        const lookupOldestInstance = sinon.spy();
        const myLambda = proxyquire( '../../src/instance_terminator', {
            './aws/autoscaling_handler': {
                findAutoscalingGroupsByTag: (tagKey, tagValue) => {
                    expect(tagKey).to.equal('can-be-terminated');
                    expect(tagValue).to.equal('true');
                    return new Promise(function (resolve) {
                        resolve(describeAutoscalingGroupsResponse_withUnhealthyInstances);
                    });
                },
                terminateInstance: terminateInstance
            },
            './aws/ec2_handler': {
                lookupOldestInstance: lookupOldestInstance
            },
        });

        return LambdaTester(myLambda.handler)
            .event()
            .expectResult((result) => {
                expect(result).to.have.lengthOf(1);
                expect(result).to.have.deep.members([{autoscalingGroupName: 'my-asg-unhealthy-instance', result: 'not enough healthy instances in group'}]);
                expect(lookupOldestInstance.notCalled, 'lookupOldestInstance should not be called').to.be.true;
                expect(terminateInstance.notCalled, 'terminate instance should not be called').to.be.true;
            });
    });

    it( `should terminate instance when all criteria is met`, function() {
        const terminateInstance = sinon.spy();
        const myLambda = proxyquire( '../../src/instance_terminator', {
            './aws/autoscaling_handler': {
                findAutoscalingGroupsByTag: (tagKey, tagValue) => {
                    expect(tagKey).to.equal('can-be-terminated');
                    expect(tagValue).to.equal('true');
                    return new Promise(function (resolve) {
                        resolve(describeAutoscalingGroupsResponse_withAllCriteriaMatched);
                    });
                },
                terminateInstance: terminateInstance
            },
            './aws/ec2_handler': {
                lookupOldestInstance: (instances) => {
                    expect(instances).to.deep.equal([{
                        InstanceId: 'i-instance-1',
                        LifecycleState: 'InService',
                        HealthStatus: 'Healthy'
                    }, {
                        InstanceId: 'i-instance-2',
                        LifecycleState: 'InService',
                        HealthStatus: 'Healthy'
                    }]);
                    return new Promise(function (resolve) {
                        resolve({InstanceId: 'i-instance-2',LaunchTime: new Date('2018-01-11T09:56:50.000Z')});
                    });
                }
            },
        });

        return LambdaTester(myLambda.handler)
            .event()
            .expectResult((result) => {
                expect(result).to.have.lengthOf(1);
                expect(result).to.have.deep.members([{autoscalingGroupName: 'my-asg', result: 'instance terminated', instanceId: 'i-instance-2'}]);
                expect(terminateInstance.calledOnce, 'terminate instance called once').to.be.true;
                expect(terminateInstance.calledWith('i-instance-2'), 'terminate instance parameters').to.be.true;
            });
    });

    it( `should terminate two instances when there are two asgs that have all criteria met`, function() {
        const terminateInstance = sinon.spy();
        const myLambda = proxyquire( '../../src/instance_terminator', {
            './aws/autoscaling_handler': {
                findAutoscalingGroupsByTag: (tagKey, tagValue) => {
                    expect(tagKey).to.equal('can-be-terminated');
                    expect(tagValue).to.equal('true');
                    return new Promise(function (resolve) {
                        resolve(describeAutoscalingGroupsResponse_withMultipleMatchingAsgs);
                    });
                },
                terminateInstance: terminateInstance
            },
            './aws/ec2_handler': {
                lookupOldestInstance: (instances) => {
                    if (instances[0]['InstanceId'] == 'i-multiple-asgs-1') {
                        expect(instances).to.deep.equal([{
                            InstanceId: 'i-multiple-asgs-1',
                            LifecycleState: 'InService',
                            HealthStatus: 'Healthy'
                        }, {
                            InstanceId: 'i-multiple-asgs-2',
                            LifecycleState: 'InService',
                            HealthStatus: 'Healthy'
                        }]);
                        return new Promise(function (resolve) {
                            resolve({InstanceId: 'i-multiple-asgs-2',LaunchTime: new Date('2018-01-11T09:56:50.000Z')});
                        });
                    }
                    if (instances[0]['InstanceId'] == 'i-multiple-asgs-3') {
                        expect(instances).to.deep.equal([{
                            InstanceId: 'i-multiple-asgs-3',
                            LifecycleState: 'InService',
                            HealthStatus: 'Healthy'
                        }, {
                            InstanceId: 'i-multiple-asgs-4',
                            LifecycleState: 'InService',
                            HealthStatus: 'Healthy'
                        }]);
                        return new Promise(function (resolve) {
                            resolve({InstanceId: 'i-multiple-asgs-4',LaunchTime: new Date('2018-01-11T09:56:50.000Z')});
                        });
                    }
                }
            },
        });

        return LambdaTester(myLambda.handler)
            .event()
            .expectResult((result) => {
                expect(result).to.have.lengthOf(2);
                expect(result).to.have.deep.members([
                {
                    autoscalingGroupName: 'my-asg-multiple-asgs',
                    result: 'instance terminated',
                    instanceId: 'i-multiple-asgs-2'
                }, {
                    autoscalingGroupName: 'another-asg-multiple-asgs',
                    result: 'instance terminated',
                    instanceId: 'i-multiple-asgs-4'
                }]);
                expect(terminateInstance.callCount, 'terminate instance called twice').to.equal(2);

                expect(terminateInstance.calledWith('i-multiple-asgs-2'), 'terminate instance parameters').to.be.true;
                expect(terminateInstance.calledWith('i-multiple-asgs-4'), 'terminate instance parameters').to.be.true;
            });
    });

    it( `should terminate a single instance across grouped asgs`, function() {
        const terminateInstance = sinon.spy();
        const myLambda = proxyquire( '../../src/instance_terminator', {
            './aws/autoscaling_handler': {
                findAutoscalingGroupsByTag: (tagKey, tagValue) => {
                    expect(tagKey).to.equal('can-be-terminated');
                    expect(tagValue).to.equal('true');
                    return new Promise(function (resolve) {
                        resolve(describeAutoscalingGroupsResponse_withGroupedAsgs);
                    });
                },
                terminateInstance: terminateInstance
            },
            './aws/ec2_handler': {
                lookupOldestInstance: (instances) => {
                    if (instances[0]['InstanceId'] == 'i-grouped-asgs-1') {
                        expect(instances).to.deep.equal([{
                            InstanceId: 'i-grouped-asgs-1',
                            LifecycleState: 'InService',
                            HealthStatus: 'Healthy'
                        }, {
                            InstanceId: 'i-grouped-asgs-2',
                            LifecycleState: 'InService',
                            HealthStatus: 'Healthy'
                        }]);
                        return new Promise(function (resolve) {
                            resolve({InstanceId: 'i-grouped-asgs-2',LaunchTime: new Date('2018-01-11T09:56:50.000Z')});
                        });
                    }
                    if (instances[0]['InstanceId'] == 'i-grouped-asgs-3') {
                        expect(instances).to.deep.equal([{
                            InstanceId: 'i-grouped-asgs-3',
                            LifecycleState: 'InService',
                            HealthStatus: 'Healthy'
                        }, {
                            InstanceId: 'i-grouped-asgs-4',
                            LifecycleState: 'InService',
                            HealthStatus: 'Healthy'
                        }]);
                        return new Promise(function (resolve) {
                            resolve({InstanceId: 'i-grouped-asgs-4',LaunchTime: new Date('2018-01-11T09:56:50.000Z')});
                        });
                    }
                    if (instances[0]['InstanceId'] == 'i-grouped-asgs-2') {
                        expect(instances).to.deep.equal([{
                            InstanceId: 'i-grouped-asgs-2',
                            LaunchTime: new Date('2018-01-11T09:56:50.000Z')
                        }, {
                            InstanceId: 'i-grouped-asgs-4',
                            LaunchTime: new Date('2018-01-11T09:56:50.000Z')
                        }]);
                        return new Promise(function (resolve) {
                            resolve({InstanceId: 'i-grouped-asgs-4', LaunchTime: new Date('2018-01-11T09:56:50.000Z')});
                        });
                    }
                }
            },
        });

        return LambdaTester(myLambda.handler)
            .event()
            .expectResult((result) => {
                expect(result).to.have.lengthOf(1);
                expect(result).to.have.deep.members([
                    {
                        instanceTerminatorGroupName: "my-test-group",
                        result: 'instance terminated',
                        instanceId: 'i-grouped-asgs-4'
                    }]);
                expect(terminateInstance.callCount, 'terminate instance called twice').to.equal(1);
                expect(terminateInstance.calledWith('i-grouped-asgs-4'), 'terminate instance parameters').to.be.true;
            });
    });

    it( `should not terminate an instance across grouped asgs if there is only one asg in the grouping`, function() {
        const terminateInstance = sinon.spy();
        const lookupOldestInstance = sinon.spy();
        const myLambda = proxyquire( '../../src/instance_terminator', {
            './aws/autoscaling_handler': {
                findAutoscalingGroupsByTag: (tagKey, tagValue) => {
                    expect(tagKey).to.equal('can-be-terminated');
                    expect(tagValue).to.equal('true');
                    return new Promise(function (resolve) {
                        resolve(describeAutoscalingGroupsResponse_withBadlyGroupedAsgs);
                    });
                },
                terminateInstance: terminateInstance
            },
            './aws/ec2_handler': {
                lookupOldestInstance: lookupOldestInstance
            },
        });

        return LambdaTester(myLambda.handler)
            .event()
            .expectResult((result) => {
                expect(result).to.have.lengthOf(1);
                expect(result).to.have.deep.members([{instanceTerminatorGroupName: 'my-test-group', result: 'instance-terminator-group tag only attached to one autoscaling group'}]);
                expect(lookupOldestInstance.notCalled, 'lookupOldestInstance should not be called').to.be.true;
                expect(terminateInstance.notCalled, 'terminate instance should not be called').to.be.true;
            });
    });

    it( `should not terminate an instance across grouped asgs if the group has no instances`, function() {
        const terminateInstance = sinon.spy();
        const lookupOldestInstance = sinon.spy();
        const myLambda = proxyquire( '../../src/instance_terminator', {
            './aws/autoscaling_handler': {
                findAutoscalingGroupsByTag: (tagKey, tagValue) => {
                    expect(tagKey).to.equal('can-be-terminated');
                    expect(tagValue).to.equal('true');
                    return new Promise(function (resolve) {
                        resolve(describeAutoscalingGroupsResponse_withGroupedAsgsWithNoInstances);
                    });
                },
                terminateInstance: terminateInstance
            },
            './aws/ec2_handler': {
                lookupOldestInstance: lookupOldestInstance
            },
        });

        return LambdaTester(myLambda.handler)
            .event()
            .expectResult((result) => {
                expect(result).to.have.lengthOf(1);
                expect(result).to.have.deep.members([{instanceTerminatorGroupName: 'my-test-group', result: 'not enough healthy instances in group'}]);
                expect(lookupOldestInstance.notCalled, 'lookupOldestInstance should not be called').to.be.true;
                expect(terminateInstance.notCalled, 'terminate instance should not be called').to.be.true;
            });
    });

    it( `should terminate one instance when there is more than one grouped asgs`, function() {
        const terminateInstance = sinon.spy();
        const myLambda = proxyquire( '../../src/instance_terminator', {
            './aws/autoscaling_handler': {
                findAutoscalingGroupsByTag: (tagKey, tagValue) => {
                    expect(tagKey).to.equal('can-be-terminated');
                    expect(tagValue).to.equal('true');
                    return new Promise(function (resolve) {
                        resolve(describeAutoscalingGroupsResponse_withMultpleGroupedAsgs);
                    });
                },
                terminateInstance: terminateInstance
            },
            './aws/ec2_handler': {
                lookupOldestInstance: (instances) => {
                    if (instances[0]['InstanceId'] == 'i-grouped-asgs-1') {
                        expect(instances).to.deep.equal([{
                            InstanceId: 'i-grouped-asgs-1',
                            LifecycleState: 'InService',
                            HealthStatus: 'Healthy'
                        }, {
                            InstanceId: 'i-grouped-asgs-2',
                            LifecycleState: 'InService',
                            HealthStatus: 'Healthy'
                        }]);
                        return new Promise(function (resolve) {
                            resolve({InstanceId: 'i-grouped-asgs-2',LaunchTime: new Date('2018-01-11T09:56:50.000Z')});
                        });
                    }
                    if (instances[0]['InstanceId'] == 'i-grouped-asgs-3') {
                        expect(instances).to.deep.equal([{
                            InstanceId: 'i-grouped-asgs-3',
                            LifecycleState: 'InService',
                            HealthStatus: 'Healthy'
                        }, {
                            InstanceId: 'i-grouped-asgs-4',
                            LifecycleState: 'InService',
                            HealthStatus: 'Healthy'
                        }]);
                        return new Promise(function (resolve) {
                            resolve({InstanceId: 'i-grouped-asgs-4',LaunchTime: new Date('2018-01-11T09:56:50.000Z')});
                        });
                    }
                    if (instances[0]['InstanceId'] == 'i-grouped-asgs-2') {
                        expect(instances).to.deep.equal([{
                            InstanceId: 'i-grouped-asgs-2',
                            LaunchTime: new Date('2018-01-11T09:56:50.000Z')
                        }, {
                            InstanceId: 'i-grouped-asgs-4',
                            LaunchTime: new Date('2018-01-11T09:56:50.000Z')
                        }]);
                        return new Promise(function (resolve) {
                            resolve({InstanceId: 'i-grouped-asgs-4', LaunchTime: new Date('2018-01-11T09:56:50.000Z')});
                        });
                    }
                }
            },
        });

        return LambdaTester(myLambda.handler)
            .event()
            .expectResult((result) => {
                expect(result).to.have.lengthOf(2);
                expect(result).to.have.deep.members([
                    {
                        instanceTerminatorGroupName: "my-test-group1",
                        result: 'instance terminated',
                        instanceId: 'i-grouped-asgs-4'
                    },{
                        instanceTerminatorGroupName: "my-test-group2",
                        result: 'instance-terminator-group tag only attached to one autoscaling group'
                    }
                ]);

                expect(terminateInstance.callCount, 'terminate instance called once').to.equal(1);
                expect(terminateInstance.calledWith('i-grouped-asgs-4'), 'terminate instance parameters').to.be.true;
            });
    });
});

const describeAutoscalingGroupsResponse_withTooFewInstances = [
    {
        AutoScalingGroupName: 'my-asg-1-instance',
        MinSize: 1,
        MaxSize: 1,
        DesiredCapacity: 1,
        Tags: []
    }
]

const describeAutoscalingGroupsResponse_withUnhealthyInstances = [
    {
        AutoScalingGroupName: 'my-asg-unhealthy-instance',
        MinSize: 2,
        MaxSize: 2,
        DesiredCapacity: 2,
        Instances:  [{
            LifecycleState: 'Pending',
            HealthStatus: 'Healthy'
        }, {
            LifecycleState: 'InService',
            HealthStatus: 'Healthy'
        }],
        Tags: []
    }
]

const describeAutoscalingGroupsResponse_withAllCriteriaMatched = [
    {
        AutoScalingGroupName: 'my-asg',
        MinSize: 2,
        MaxSize: 2,
        DesiredCapacity: 2,
        Instances:  [{
            InstanceId: 'i-instance-1',
            LifecycleState: 'InService',
            HealthStatus: 'Healthy'
        }, {
            InstanceId: 'i-instance-2',
            LifecycleState: 'InService',
            HealthStatus: 'Healthy'
        }],
        Tags: []
    }
]

const describeAutoscalingGroupsResponse_withMultipleMatchingAsgs = [
    {
        AutoScalingGroupName: 'my-asg-multiple-asgs',
        MinSize: 2,
        MaxSize: 2,
        DesiredCapacity: 2,
        Instances:  [{
            InstanceId: 'i-multiple-asgs-1',
            LifecycleState: 'InService',
            HealthStatus: 'Healthy'
        }, {
            InstanceId: 'i-multiple-asgs-2',
            LifecycleState: 'InService',
            HealthStatus: 'Healthy'
        }],
        Tags: []
    },
    {
        AutoScalingGroupName: 'another-asg-multiple-asgs',
        MinSize: 2,
        MaxSize: 2,
        DesiredCapacity: 2,
        Instances:  [{
            InstanceId: 'i-multiple-asgs-3',
            LifecycleState: 'InService',
            HealthStatus: 'Healthy'
        }, {
            InstanceId: 'i-multiple-asgs-4',
            LifecycleState: 'InService',
            HealthStatus: 'Healthy'
        }],
        Tags: []
    }
]

const describeAutoscalingGroupsResponse_withGroupedAsgs = [
    {
        AutoScalingGroupName: 'my-asg-grouped-asgs',
        MinSize: 2,
        MaxSize: 2,
        DesiredCapacity: 2,
        Instances:  [{
            InstanceId: 'i-grouped-asgs-1',
            LifecycleState: 'InService',
            HealthStatus: 'Healthy'
        }, {
            InstanceId: 'i-grouped-asgs-2',
            LifecycleState: 'InService',
            HealthStatus: 'Healthy'
        }],
        Tags: [{
            Key: 'instance-terminator-group',
            Value: 'my-test-group'
        }]
    },
    {
        AutoScalingGroupName: 'another-asg-grouped-asgs',
        MinSize: 2,
        MaxSize: 2,
        DesiredCapacity: 2,
        Instances:  [{
            InstanceId: 'i-grouped-asgs-3',
            LifecycleState: 'InService',
            HealthStatus: 'Healthy'
        }, {
            InstanceId: 'i-grouped-asgs-4',
            LifecycleState: 'InService',
            HealthStatus: 'Healthy'
        }],
        Tags: [{
            Key: 'instance-terminator-group',
            Value: 'my-test-group'
        }]
    }
]

const describeAutoscalingGroupsResponse_withBadlyGroupedAsgs = [
    {
        AutoScalingGroupName: 'my-asg-grouped-asgs',
        MinSize: 2,
        MaxSize: 2,
        DesiredCapacity: 2,
        Instances:  [{
            InstanceId: 'i-grouped-asgs-1',
            LifecycleState: 'InService',
            HealthStatus: 'Healthy'
        }, {
            InstanceId: 'i-grouped-asgs-2',
            LifecycleState: 'InService',
            HealthStatus: 'Healthy'
        }],
        Tags: [{
            Key: 'instance-terminator-group',
            Value: 'my-test-group'
        }]
    }
]

const describeAutoscalingGroupsResponse_withGroupedAsgsWithNoInstances = [
    {
        AutoScalingGroupName: 'my-asg-grouped-asgs',
        MinSize: 0,
        MaxSize: 0,
        DesiredCapacity: 0,
        Instances:  [],
        Tags: [{
            Key: 'instance-terminator-group',
            Value: 'my-test-group'
        }]
    },
    {
        AutoScalingGroupName: 'another-asg-grouped-asgs',
        MinSize: 0,
        MaxSize: 0,
        DesiredCapacity: 0,
        Instances:  [],
        Tags: [{
            Key: 'instance-terminator-group',
            Value: 'my-test-group'
        }]
    }
]

const describeAutoscalingGroupsResponse_withMultpleGroupedAsgs = [
    {
        AutoScalingGroupName: 'my-asg-grouped-asgs',
        MinSize: 2,
        MaxSize: 2,
        DesiredCapacity: 2,
        Instances:  [{
            InstanceId: 'i-grouped-asgs-1',
            LifecycleState: 'InService',
            HealthStatus: 'Healthy'
        }, {
            InstanceId: 'i-grouped-asgs-2',
            LifecycleState: 'InService',
            HealthStatus: 'Healthy'
        }],
        Tags: [{
            Key: 'instance-terminator-group',
            Value: 'my-test-group1'
        }]
    },
    {
        AutoScalingGroupName: 'another-asg-grouped-asgs',
        MinSize: 2,
        MaxSize: 2,
        DesiredCapacity: 2,
        Instances:  [{
            InstanceId: 'i-grouped-asgs-3',
            LifecycleState: 'InService',
            HealthStatus: 'Healthy'
        }, {
            InstanceId: 'i-grouped-asgs-4',
            LifecycleState: 'InService',
            HealthStatus: 'Healthy'
        }],
        Tags: [{
            Key: 'instance-terminator-group',
            Value: 'my-test-group1'
        }]
    },
    {
        AutoScalingGroupName: 'third-grouped-asgs',
        MinSize: 2,
        MaxSize: 2,
        DesiredCapacity: 2,
        Instances:  [{
            InstanceId: 'i-grouped-asgs-5',
            LifecycleState: 'InService',
            HealthStatus: 'Healthy'
        }, {
            InstanceId: 'i-grouped-asgs-6',
            LifecycleState: 'InService',
            HealthStatus: 'Healthy'
        }],
        Tags: [{
            Key: 'instance-terminator-group',
            Value: 'my-test-group2'
        }]
    },
]