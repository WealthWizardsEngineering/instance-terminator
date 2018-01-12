variable "lambda_schedule" {
  description = "The schedule for running the Lambda"
  default     = "rate(1 day)"
}