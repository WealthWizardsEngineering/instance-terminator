# instance-terminator

A AWS Lambda function to automatically terminate hosts on autoscaling groups - using Terraform.

This will run periodically and identify autoscaling groups tagged with can-be-terminated = 'true' and terminate the
oldest instance as long as the group has 2 or more instances and the number of healthy instances is at least equal to
the desired number of instances.

## Rationale

This was created out of the need to do a rolling update of our autoscaling groups when updating the AMI.

We run immutable infrastructure, so patching our servers involves creating a new AMI and rebuilding our hosts, this
function will do this over a number of days (or more frequently if desired).

In addition to this we aim to provide a highly available infrastructure that can continue to work when nodes are lost,
so regularly terminating nodes will help highly issues quickly.

## Usage

To use this module in your Terraform definition, add the following:

```
module "instance_terminator" {
  source = "github.com/WealthWizardsEngineering/instance-terminator"
}
```

## Configuration

* lambda_schedule - the schedule for the Lambda function, see the [Lambda documentation for details](https://docs.aws.amazon.com/lambda/latest/dg/tutorial-scheduled-events-schedule-expressions.html)