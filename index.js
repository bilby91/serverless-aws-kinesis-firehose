var aws = require('aws-sdk');

const PROCESSOR_OPTIONS = ['numberOfRetries', 'bufferSizeInMBs', 'bufferIntervalInSeconds'];

class KinesisFirehosePlugin {
  constructor(serverless, options = {}) {
    this.serverless = serverless;
    this.options = options;

    this.firehose = new aws.Firehose();
    this.lambda = new aws.Lambda();

    this.hooks = {
      'aws:common:validate:validate': this.validateSchema.bind(this),
      'before:deploy:finalize': this.attachLambdaToFirehose.bind(this),
    };
  }

  /**
   * Validate that any present firehose event is valid
   */
  async validateSchema() {
    this.firehoseFunctions()
      .reduce((events, serverlessFunction) => {
        return events.concat(this.getFirehoseEvents(serverlessFunction));
      }, [])
      .forEach(event => {
        if (!event.deliveryStreamName) {
          throw new Error(
            `[kinesis-firehose-serverless-plugin] Missing kinseis firehose deliveryStreamName for function ${
              f.function_key
            }`,
          );
        }
      });
  }

  /**
   * Attach all the lambda functions that have a firehose event to the appropiate delivery streams.
   */
  async attachLambdaToFirehose() {
    const funcs = this.firehoseFunctions();

    await Promise.all(
      funcs.map(async serverlessFunction => {
        const awsLambda = await this.lambda
          .getFunction({
            FunctionName: serverlessFunction.name,
          })
          .promise();

        await Promise.all(
          this.getFirehoseEvents(serverlessFunction).map(async serverlessEvent => {
            const awsFirehoseStream = await this.firehose
              .describeDeliveryStream({
                DeliveryStreamName: serverlessEvent.deliveryStreamName,
              })
              .promise();

            await this.firehose
              .updateDestination(
                this.buildFirehoseDesinationConfiguration(awsFirehoseStream, awsLambda, serverlessEvent),
              )
              .promise();
          }),
        );
      }),
    );
  }

  /**
   * Build the AWS destination configuration for the given event
   *
   * @param {AWS.Firehose.DescribeDeliveryStreamOutput} stream
   * @param {AWS.Lambda.GetFunctionResponse} lambda
   * @param {Object} serverlessEvent
   */
  buildFirehoseDesinationConfiguration(stream, lambda, serverlessEvent) {
    return {
      DeliveryStreamName: serverlessEvent.deliveryStreamName,
      CurrentDeliveryStreamVersionId: stream.DeliveryStreamDescription.VersionId,
      DestinationId: stream.DeliveryStreamDescription.Destinations[0].DestinationId,
      ExtendedS3DestinationUpdate: {
        ProcessingConfiguration: {
          Enabled: true,
          Processors: this.buildFirehoseProcessor(lambda, serverlessEvent),
        },
      },
    };
  }

  /**
   * Build the AWS firehose processor information for the given event
   *
   * @param {AWS.Lambda.GetFunctionResponse} lambda
   * @param {Object} serverlessEvent
   */
  buildFirehoseProcessor(lambda, serverlessEvent) {
    const parameters = PROCESSOR_OPTIONS.reduce(
      (newParameters, optionKey) => {
        if (!Object.keys(serverlessEvent).includes(optionKey)) {
          return newParameters;
        }

        return newParameters.concat({
          ParameterName: optionKey.charAt(0).toUpperCase() + optionKey.slice(1),
          ParameterValue: serverlessEvent[optionKey],
        });
      },
      [
        {
          ParameterName: 'LambdaArn',
          ParameterValue: lambda.Configuration.FunctionArn,
        },
      ],
    );

    return [
      {
        Type: 'Lambda',
        Parameters: parameters,
      },
    ];
  }

  /**
   * Get all the serverless functions that at least have one firehose event
   */
  firehoseFunctions() {
    return Object.keys(this.serverless.service.functions)
      .map(function_key => {
        return {
          ...this.serverless.service.functions[function_key],
          function_key,
        };
      })
      .filter(f => this.getFirehoseEvents(f).length > 0);
  }

  /**
   * Get all the firehose events attached on the given function
   *
   * @param {Object} serverlessFunction
   */
  getFirehoseEvents(serverlessFunction) {
    if (!serverlessFunction.events) {
      return [];
    }

    return serverlessFunction.events
      .filter(event => {
        return Object.keys(event).includes('firehose');
      })
      .map(event => {
        return event.firehose;
      });
  }
}

module.exports = KinesisFirehosePlugin;
