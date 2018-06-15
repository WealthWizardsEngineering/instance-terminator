# instance-terminator

A AWS Lambda function to automatically terminate hosts on autoscaling groups.

When run it will identify autoscaling groups tagged with can-be-terminated = 'true' and terminate the oldest instance as
long as the group has 2 or more instances and the number of healthy instances is at least equal to the desired number of
instances.

## Rationale

This was created out of the need to do a rolling update of our autoscaling groups when updating the AMI.

We run immutable infrastructure, so patching our servers involves creating a new AMI and rebuilding our hosts, this
function will do this over a number of days (or more frequently if desired).

In addition to this we aim to provide a highly available infrastructure that can continue to work when nodes are lost,
so regularly terminating nodes will help highly issues quickly.

## Usage

Upload this as a lambda function that is trigger by a cloudwatch scheduled event, it will require an appropriate role
that allows it access to query and terminate autoscaling group instances.

The required configuration is defined and can be applied by this Terraform module:
[instance-terminator-terraform](https://github.com/WealthWizardsEngineering/instance-terminator-terraform)

The instance terminator will not act on any instances unless you add the relevant tags to your AWS autoscaling group:

* can-terminate - set to `true` to enable the autoscaling group to be inspected by the terminator
* instance-terminator-group - set to the name of the group to allow the terminator to group this autoscaling group with
other autoscaling groups with the same value for this tag and delete the oldest instance across them all