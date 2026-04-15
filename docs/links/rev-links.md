<!-- Source: https://docs.rev.ai/get-started.md -->

# Get Started

This short tutorial will teach you the basics of making requests to the Rev AI APIs. This tutorial uses the Asynchronous Speech to Text API to produce a transcript of an audio file submitted by you.

## Assumptions

This tutorial assumes that you have a Rev AI account. If not, [sign up for a free account](https://www.rev.ai/auth/signup).

## Step 1: Get your access token

The first step is to generate an access token, which will enable access to the Rev AI APIs. Follow these steps:

1. [Log in](https://www.rev.ai/auth/login) to Rev AI.
2. Navigate to the [**Access Token** page](https://www.rev.ai/access-token).
3. Click the **Generate New Access Token** link. Confirm the operation in the pop-up dialog box.


![Creating an access token](/images/create-token.png)

The new access token will be generated and displayed on the screen.

Save your access tokens somewhere safe; you will only be able to see them once. You are allowed a maximum of 2 access tokens at a time.

## Step 2: Submit a file for transcription

Submit an audio file for transcription to Rev AI using the command below. Replace the `<REVAI_ACCESS_TOKEN>` placeholder with the access token obtained in Step 1, and replace the sample file URL shown below with the URL to your own audio file if required.


```bash
curl -X POST "https://api.rev.ai/speechtotext/v1/jobs" \
     -H "Authorization: Bearer <REVAI_ACCESS_TOKEN>" \
     -H "Content-Type: application/json" \
     -d '{"source_config": {"url": "https://www.rev.ai/FTC_Sample_1.mp3"},"metadata":"This is a test"}'
```

You'll receive a response like this:


```bash
{
  "id": "Umx5c6F7pH7r",
  "created_on": "2021-09-15T05:14:38.13",
  "name": "FTC_Sample_1.mp3",
  "metadata": "This is a test",
  "status": "in_progress",
  "type": "async",
  "language": "en"
}
```

The `id` (in this case `Umx5c6F7pH7r`) will enable you to retrieve your transcript.

## Step 3: Retrieve the transcript

You now need to wait for the job to complete. Wait for approximately 1 minute and then check the `status` of your job by querying the API as shown below:


```bash
curl -X GET https://api.rev.ai/speechtotext/v1/jobs/<ID> \
     -H "Authorization: Bearer <REVAI_ACCESS_TOKEN>"
```

Polling the API periodically for job status is NOT recommended in a production server. Rather, use [webhooks](/api/asynchronous/webhooks) to asynchronously receive notifications once the transcription job completes.

Once a transcription job's `status` changes to `transcribed`, you can retrieve the transcript in JSON format by running the command below. As before, replace the `<REVAI_ACCESS_TOKEN>` placeholder with the access token obtained in Step 1. You must also replace the `<ID>` placeholder with the `id` obtained in Step 2.


```bash
curl -X GET "https://api.rev.ai/speechtotext/v1/jobs/<ID>/transcript" \
     -H "Authorization: Bearer <REVAI_ACCESS_TOKEN>" \
     -H "Accept: application/vnd.rev.transcript.v1.0+json"
```

Here is an example of the output:


```javascript
{
  "monologues": [
    {
      "speaker": 1,
      "elements": [
        {
          "type": "text",
          "value": "Hi",
          "ts": 0.27,
          "end_ts": 0.32,
          "confidence": 1
        },
        {
          "type": "punct",
          "value": ","
        },
        {
          "type": "punct",
          "value": " "
        },        
        {
          "type": "text",
          "value": "my",
          "ts": 0.35,
          "end_ts": 0.46,
          "confidence": 1
        },
        {
          "type": "punct",
          "value": " "
        },
        {
          "type": "text",
          "value": "name's",
          "ts": 0.47,
          "end_ts": 0.59,
          "confidence": 1
        },
        {
          ...
        }
      ]
    },
    {
      ...
    }
  ]
}
```

Alternatively, you can get the plaintext version by running the command below:


```bash
curl -X GET "https://api.rev.ai/speechtotext/v1/jobs/<ID>/transcript" \
     -H "Authorization: Bearer <REVAI_ACCESS_TOKEN>" \
     -H "Accept: text/plain"
```

## Next steps

You should now have a basic idea of how to use the Rev AI APIs. To learn more, read [the API documentation](/api) for complete details on the different APIs available and their features. You can also find [code samples and SDK documentation](/sdk) that will help you connect your application with the APIs.

<!-- Source: https://docs.rev.ai/api/features.md -->

# Features

The following features are available in the Asynchronous Speech-to-Text and Streaming Speech-to-Text APIs.

## Custom vocabularies

To improve accuracy of the ASR when using words or terms that are not in the average English dictionary, submit these words as custom vocabulary.

Custom vocabularies are submitted as a list of phrases. A phrase can be one word or multiple words, usually describing a single object or concept.

Here is an example of submitting a custom vocabulary to the API containing the made-up word `sparkletini`:


```bash
curl -X POST "https://api.rev.ai/speechtotext/v1/vocabularies" \
    -H "Authorization: Bearer <REVAI_ACCESS_TOKEN>" \
    -H "Content-Type: application/json" \
    -d '{ "custom_vocabularies": [{ "phrases": ["sparkletini"] }] }'
```

Learn more in the [Custom Vocabulary API Reference](/api/custom-vocabulary).

## Punctuation and inverse text normalization

Rev AI automatically adds punctuation and performs inverse text normalization on all audio processed. Inverse text normalization or ITN is the process of converting spoken-form text to written-form text. This includes dates, times and phone numbers.

Examples:

- Dates: "June twentieth twenty twenty" becomes "June 20th, 2020"
- Phone numbers - "one two three one two three one two three four" becomes "(123)123-1234"


ITN is performed on all audio submitted to the Asynchronous Speech-to-Text API. For audio submitted to the Streaming Speech-to-Text API, ITN is only performed on Final Hypotheses.

Here is an example of a transcript containing punctuation:


```javascript
{
  "monologues": [
    {
      "speaker": 1,
      "elements": [
        {
          "type": "text",
          "value": "Hello",
          "ts": 0.5,
          "end_ts": 1.5,
          "confidence": 1
        },
        {
          "type": "punct",
          "value": " "
        },
        {
          "type": "text",
          "value": "World",
          "ts": 1.75,
          "end_ts": 2.85,
          "confidence": 0.8
        },
        {
          "type": "punct",
          "value": "."
        }
      ]
    },
    {
      ...
    }
  ]
}
```

Learn more about punctuation control in the [Asynchronous Speech-to-Text API Reference](/api/asynchronous) and the [Streaming Speech-to-Text API Reference](/api/streaming/requests#custom-vocabulary).

## Disfluency or filler word removal

Disfluencies can be distracting because they break the flow of speech. This is especially true for written text. The APIs currently only filter for "ums" and "uhs" but when this setting is enabled, disfluencies will not appear in the transcription output.

Learn more about disfluency removal in the [Asynchronous Speech-to-Text API Reference](/api/asynchronous) and the [Streaming Speech-to-Text API Reference](/api/streaming/requests#disfluencies).

## Profanity filtering

The current profanity dictionary contains approximately 600 profane words and phrases. When this feature is enabled, all the words transcribed that are included on this list will be displayed as asterisks except the first and last character.

Learn more about profanity filtering in the [Asynchronous Speech-to-Text API Reference](/api/asynchronous) and the [Streaming Speech-to-Text API Reference](/api/streaming/requests#profanity-filter).

## Timestamps

The JSON transcription output includes timestamps for every transcribed word. Timestamps correspond to when the words are spoken within the audio and can be used for alignment, analytics, live captions, etc.

Here is an example of a transcript with timestamps:


```javascript
{
  "monologues": [
    {
      "speaker": 0,
      "elements": [
        {
          "type": "text",
          "value": "Hi",
          "ts": 0.27,
          "end_ts": 0.48,
          "confidence": 1
        },
        {
          "type": "text",
          "value": "my",
          "ts": 0.51,
          "end_ts": 0.66,
          "confidence": 1
        },
        {
          "type": "text",
          "value": "name's",
          "ts": 0.66,
          "end_ts": 0.84,
          "confidence": 0.84
        },
        {
          "type": "text",
          "value": "Jack",
          "ts": 0.84,
          "end_ts": 1.05,
          "confidence": 0.99
        },
        {
          ...
        }
      ]
    }
  ]
}
```

Learn more about working with timestamps in the [Asynchronous Speech-to-Text API Reference](/api/asynchronous) and the [Streaming Speech-to-Text API Reference](/api/streaming/requests#start-timestamp).

## Speaker separation or diarization

Speaker diarization is the process of separating audio segments according to speaker identification. Diarization is performed by default on all audio processed through the Asynchronous Speech-to-Text API. When multiple speakers are detected, transcription output will be separated by speaker.

Here is an example of a transcript with multiple speakers:


```javascript
{
  "monologues": [
    {
      "speaker": 0,
      "elements": [
        {
          "type": "text",
          "value": "Hi",
          "ts": 0.27,
          "end_ts": 0.48,
          "confidence": 1
        },
        ...
      ]
    },
    {
      "speaker": 1,
      "elements": [
        {
          "type": "text",
          "value": "Although",
          "ts": 3.14,
          "end_ts": 3.56,
          "confidence": 1
        },
        ...
      ]
    }
  ]
}
```

Learn more about speaker diarization in the Asynchronous Speech-to-Text [API Reference](/api/asynchronous) and [Best Practices Guide](/api/asynchronous/best-practices#multi-channel-audio).

<!-- Source: https://docs.rev.ai/api/asynchronous.md -->

# Overview

The Asynchronous Speech-to-Text API delivers high-quality transcription for pre-recorded audio.

For a streaming solution, refer to the [Streaming Speech-to-Text API](/api/streaming) documentation.

## API endpoint

The base URL for this version of the API is `https://api.rev.ai/speechtotext/v1`. All endpoints described in this documentation are relative to this base URL.

The base URL for this version of the API differs for non-US deployments. Users working with non-US deployments should obtain the correct base URL for their deployment from the [Rev AI global deployments](/api/global-deployments) page.

The base URL is different from the base URL for the Streaming Speech-to-Text API.

## Authentication

Clients must authenticate by including their [Rev AI access token](/api/security#access-token) in the `Authorization:` header of their requests. If the access token is invalid or the header is not present, a `401` error code will be returned.

## Turnaround time and chunking

Chunking is the act of breaking audio files into smaller segments. Rev AI uses this method to decrease turnaround time of audio files greater than 3 minutes in length.

Often, especially for AI transcription jobs involving shorter files, your transcript will be ready in 5 minutes or less. It generally takes no longer than 15 minutes to return longer audio files.

The expected turnaround time is 12 to 24 hours for human transcription jobs.

If you require faster turnaround time, please contact the support team at [support@rev.ai](mailto:support@rev.ai).

## File formats

The Asynchronous Speech-to-Text API supports all the [file formats supported by FFmpeg](https://ffmpeg.org/general.html#File-Formats). This includes common media formats such as MP3, MP4, Ogg, WAV, PCM and FLAC and many more.

## API limits

The following default limits apply per user, per endpoint for the Asynchronous Speech-to-Text API:

- 10,000 transcription requests submitted every 10 minutes.
- 500 transcriptions processed every 10 minutes. Any submissions over this will be accepted but put into a queue and not started until the next interval.
- Maximum audio duration of 17 hours.
- File uploads submitted as `multipart/form-data` requests to the `/jobs` endpoint have a concurrency limit of 5 and a file size limit of 2 GB per request.
- File uploads via the Rev AI dashboard or using the `source_config` job parameter have a file size limit of 5 TB.


POST requests to the `/jobs` endpoint that use the `source_config` property do not have a concurrency limit or file restriction. They are only limited by the first three limits specified above.

These default limits are configurable by Rev AI support. To adjust these limits, contact the support team at [support@rev.ai](mailto:support@rev.ai).

## HIPAA compliance

The API supports HIPAA-compliant processing. However, this feature is not activated by default and must be explicitly activated at account level. Learn more about [Rev AI's HIPAA compliance and how to HIPAA-enable a Rev AI user account](/api/hipaa).

The API has the following limitations in HIPAA context:

1. When submitting a media file, the [`media_url`](/api/asynchronous) option is not supported. Instead, the [`source_config`](/api/asynchronous) option must be used.
2. Human transcription ([`transcriber=human`](/api/asynchronous)) is not supported.


## Error codes

The API indicates failure with `4xx` and `5xx` HTTP status codes. `4xx` status codes indicate an error due to the request provided (for example, a required parameter was omitted). `5xx` error indicate an error with Rev AI's servers.

The following table lists common `4xx` error codes and troubleshooting suggestions for each:

| Status Code | Error | Troubleshooting |
|  --- | --- | --- |
| 401 | Authorization Denied | Verify that the access token is valid. |
| 403 | Access Denied to Deployment | Verify that the API endpoint in use is correct for your selected deployment or region. |
| 405 | Invalid Job Properties | Verify that the job parameter names and values are valid. |
| 404 | Resource Not Found | Verify that the job identifier is valid. |
| 406 | Unsupported Output Format | Verify that the requested output format is valid. |
| 409 | Invalid Job State | Verify that the job has completed processing. |
| 413 | Payload Too Large | Verify that the submitted file size is within the allowed [API limits](#api-limits). |


When a `4xx` error occurs during invocation of a request, the API responds with a [problem details](https://tools.ietf.org/html/rfc7807) HTTP response payload.

Some errors can be resolved simply by retrying the request. The following error codes are likely to be resolved with successive retries.

| Status Code | Error |
|  --- | --- |
| 409 | Invalid Job State |
| 429 | Too Many Requests |
| 502 | Bad Gateway |
| 503 | Service Unavailable |
| 504 | Gateway Timeout |


With the exception of the `429` status code, it is recommended that the maximum number of retries be limited to 5 attempts per request. The number of retries can be higher for `429` errors but if you notice consistent throttling, please contact the support team at [support@rev.ai](mailto:support@rev.ai).

### Error object

The problem details information is represented as a JSON object with the following optional properties:

| Property | Description |
|  --- | --- |
| `type` | A URL representing the type for the error |
| `title` | A short human readable description of type |
| `details` | Additional details of the error |
| `status` | HTTP status code of the error |


In addition to the properties listed above, the problem details object may list additional properties that help to troubleshoot the problem.

Here is an example of a response to a job request with a missing required parameter:


```json
// Bad Submit Job Request
{
  "parameter": {
    "source_config.url": [
      "The url field is required."
    ]
  },
  "type": "https://www.rev.ai/api/v1/errors/invalid-parameters",
  "title": "Your request parameters didn't validate",
  "status": 400
}
```

Here is an example of a response to an invalid job:


```json
// Invalid Transcript State
{
  "allowed_values": [
    "transcribed"
  ],
  "current_value": "in_progress",
  "type": "https://rev.ai/api/v1/errors/invalid-job-state",
  "title": "Job is in invalid state",
  "detail": "Job is in invalid state to obtain the transcript",
  "status": 409
}
```

## Billing

For billing purposes, files are charged per second, with a minimum charge of 15 seconds.

Here are some examples:

- 4-second files are charged as 15 seconds.
- 14.1-second files are charged as 15 seconds.
- 15-second files are charged as 15 seconds.
- 16-second files are charged as 16 seconds.
- 16.1-second files are charged as 17 seconds.
- 22.7-second files are charged as 23 seconds.


[Human transcription](/api/asynchronous/transcribers#human-transcription) files are charged per second with a minimum charge of 1 minute.

<!-- Source: https://docs.rev.ai/api/asynchronous/get-started.md -->

# Get Started

This short tutorial will teach you the basics of using the Asynchronous Speech-to-Text API. It demonstrates how to produce a transcript of an audio file submitted by you.

## Assumptions

This tutorial assumes that you have a Rev AI account. If not, [sign up for a free account](https://www.rev.ai/auth/signup).

## Step 1: Get your access token

The first step is to generate an access token, which will enable access to the Rev AI APIs. Follow these steps:

1. [Log in](https://www.rev.ai/auth/login) to Rev AI.
2. Navigate to the [**Access Token** page](https://www.rev.ai/access-token).
3. Click the **Generate New Access Token** link. Confirm the operation in the pop-up dialog box.


![Creating an access token](/images/create-token.png)

The new access token will be generated and displayed on the screen.

Save your access tokens somewhere safe; you will only be able to see them once. You are allowed a maximum of 2 access tokens at a time.

## Step 2: Submit a file for transcription

Submit an audio file for transcription to Rev AI using the command below. Replace the `<REVAI_ACCESS_TOKEN>` placeholder with the access token obtained in Step 1, and replace the sample file URL shown below with the URL to your own audio file if required.


```bash
curl -X POST "https://api.rev.ai/speechtotext/v1/jobs" \
     -H "Authorization: Bearer <REVAI_ACCESS_TOKEN>" \
     -H "Content-Type: application/json" \
     -d '{"source_config": {"url": "https://www.rev.ai/FTC_Sample_1.mp3"},"metadata":"This is a test"}'
```

You'll receive a response like this:


```bash
{
  "id": "Umx5c6F7pH7r",
  "created_on": "2021-09-15T05:14:38.13",
  "name": "FTC_Sample_1.mp3",
  "metadata": "This is a test",
  "status": "in_progress",
  "type": "async",
  "language": "en"
}
```

The `id` (in this case `Umx5c6F7pH7r`) will enable you to retrieve your transcript.

## Step 3: Retrieve the transcript

You now need to wait for the job to complete. Wait for approximately 1 minute and then check the `status` of your job by querying the API as shown below:


```bash
curl -X GET https://api.rev.ai/speechtotext/v1/jobs/<ID> \
     -H "Authorization: Bearer <REVAI_ACCESS_TOKEN>"
```

Polling the API periodically for job status is NOT recommended in a production server. Rather, use [webhooks](/api/asynchronous/webhooks) to asynchronously receive notifications once the transcription job completes.

Once a transcription job's `status` changes to `transcribed`, you can retrieve the transcript in JSON format by running the command below. As before, replace the `<REVAI_ACCESS_TOKEN>` placeholder with the access token obtained in Step 1. You must also replace the `<ID>` placeholder with the `id` obtained in Step 2.


```bash
curl -X GET "https://api.rev.ai/speechtotext/v1/jobs/<ID>/transcript" \
     -H "Authorization: Bearer <REVAI_ACCESS_TOKEN>" \
     -H "Accept: application/vnd.rev.transcript.v1.0+json"
```

Here is an example of the output:


```javascript
{
  "monologues": [
    {
      "speaker": 1,
      "elements": [
        {
          "type": "text",
          "value": "Hi",
          "ts": 0.27,
          "end_ts": 0.32,
          "confidence": 1
        },
        {
          "type": "punct",
          "value": ","
        },
        {
          "type": "punct",
          "value": " "
        },        
        {
          "type": "text",
          "value": "my",
          "ts": 0.35,
          "end_ts": 0.46,
          "confidence": 1
        },
        {
          "type": "punct",
          "value": " "
        },
        {
          "type": "text",
          "value": "name's",
          "ts": 0.47,
          "end_ts": 0.59,
          "confidence": 1
        },
        {
          ...
        }
      ]
    },
    {
      ...
    }
  ]
}
```

Alternatively, you can get the plaintext version by running the command below:


```bash
curl -X GET "https://api.rev.ai/speechtotext/v1/jobs/<ID>/transcript" \
     -H "Authorization: Bearer <REVAI_ACCESS_TOKEN>" \
     -H "Accept: text/plain"
```

## Next steps

You should now have a basic idea of how to use the Asynchronous Speech-to-Text API. To learn more, read [the API documentation](/api/asynchronous) for complete details on the different resources and operations available in this API. You can also read about our [other APIs](/api) and find [code samples and SDK documentation](/sdk) that will help you connect your application with the API.

<!-- Source: https://docs.rev.ai/api/asynchronous/files.md -->

# File Submission

Two `POST` request formats can be used to submit a file: `application/json` or `multipart/form-data`.

## JSON

This is the preferred method of file submission. It uses the `source_config` request parameter to provide a direct download URL to the Rev AI server.

This method supports the use of pre-signed URLs. Links to videos hosted on platforms like YouTube are not valid because they are not direct download links.

To submit a download URL with restricted access, authorization headers can be provided in the `source_config` parameter. More details on the `source_config` parameter can be found on the [submission details page](/api/asynchronous/).

Signed URLs usually have an expiration time which is configurable. To ensure the Rev AI server can access the link, make sure the expiration time is set to 2 hours or more. In the event you plan on resending the same file, make sure to generate a new pre-signed URL.

## Form data

This method can be used to send a local file to the Rev AI server directly from the host machine as a `multipart/form-data` request.

## Limits

The following default limits apply per user, per endpoint for the Asynchronous Speech-to-Text API:

- 10,000 transcription requests submitted every 10 minutes.
- 500 transcriptions processed every 10 minutes. Any submissions over this will be accepted but put into a queue and not started until the next interval.
- Maximum audio duration of 17 hours.
- File uploads submitted as `multipart/form-data` requests to the `/jobs` endpoint have a concurrency limit of 5 and a file size limit of 2 GB per request.
- File uploads via the Rev AI dashboard or using the `source_config` job parameter have a file size limit of 5 TB.

<!-- Source: https://docs.rev.ai/api/asynchronous/webhooks.md -->

# Webhooks

If the optional `notification_config` parameter is provided, the API will make an HTTP POST request to the URL specified in that parameter with details in the request body when the job either completes successfully or fails.

To use a webhook URL with restricted access, authorization headers can also be provided in the `notification_config` parameter.

Details on using the `notification_config` parameter can be found on the [submission details page](/api/asynchronous/).

Here is an example of the POST request body sent after a successful transcription job:


```json
{
  "job": {
    "id": "Umx5c6F7pH7r",
    "status": "transcribed",
    "created_on": "2018-05-05T23:23:22.29Z",
    "duration_seconds": 356.24,
  }
}
```

Here is an example of the POST request body sent after a failed transcription job:


```json
{
  "job": {
    "id": "Umx5c6F7pH7r",
    "status": "failed",
    "created_on": "2018-05-05T23:23:22.29Z",
    "failure": "download_failure",
    "failure_detail": "Failed to download media file. Please check your url and file type"
  }
}
```

- The API will make a POST request, not a GET request, to the `notification_config.url` parameter. The request body will contain the job details.
- You can unsubscribe from a webhook by responding to the webhook request with a `200` response code.
- If a webhook invocation does not receive a `200` response, Rev AI will retry the callback URL every 30 minutes until either 24 hours have passed or a `200` response code is received.


Good third-party tools for webhook testing are [Webhook.site](https://webhook.site/) and [RequestBin](https://requestbin.com/).

Learn [the basics of webhooks](/resources/tutorials/get-started-api-webhooks) and then see an [example of sending email notifications on job completion with webhooks](/resources/tutorials/send-email-notifications-webhooks).

<!-- Source: https://docs.rev.ai/api/asynchronous/transcribers.md -->

# Transcription Options

A number of transcription options are available, both machine and human.

## Machine transcription

### Default model

The Reverb ASR model is our latest, most advanced ASR model. It supports English only and has full feature parity with our older v1 ASR model. It is our default model for all ASR transcription requests.

When no `transcriber` option is provided, or if the `transcriber` option is set to `machine`, transcription will be performed by the Reverb ASR model.

The `transcriber` option is ignored for non-English transcription requests.

The Reverb ASR model represents an entirely new architecture that promises 25-30% relative improvement in accuracy. Read more in our [blog post describing the new Reverb ASR model](https://www.rev.ai/blog/rev-improves-accuracy-by-over-25-with-launch-of-new-v2-asr-model/).

### V1 ASR model

The v1 ASR model was our older ASR model. It was deprecated on September 8, 2022 and is no longer available.

## Human transcription

When the `transcriber` option is set to `human`, the audio file will be transcribed by a human. Since the job is handled by a human transcriber, the expected behavior differs from the ASR transcription services. Human transcription is only available for English transcription requests.

### List pricing

Refer to the [Rev AI pricing page](https://www.rev.ai/pricing) for up-to-date prices. Add-on prices are stated below and are in addition to the list pricing.

| Product | Cost (per Minute) |
|  --- | --- |
| Rush (Add-on) | +$1.25 |
| Verbatim (Add-on) | +$0.50 |


Please reach out to [support@rev.ai](mailto:support@rev.ai) if you have any questions on pricing.

Enterprise pricing is available for enterprise customers. Contact your Rev Account Manager for more information.

### Turnaround time

The expected turnaround time is 12 to 24 hours for human transcription jobs. However, human transcription results are not available via the Rev website. They are returned via the API like any other Rev AI job.

### Allowed content

Certain types of audio content that are considered unworkable by our transcribers will not be transcribed.  Audio that consists of non-English or music may be considered unworkable. Valid audio consists primarily of spoken English.

### Custom vocabulary

Phrases from the custom vocabulary list (if available) is sent to the human transcriber as glossary. This is limited to a maximum of 20 phrases and a maximum of 255 characters per phrase.

### Additional request parameters

#### Rush

Rush charges apply.

Set the `rush` parameter to `true` to increase the priority of the job to be worked on by human transcribers.

#### Verbatim

Verbatim charges apply.

Set the `verbatim` parameter to `true` to tell the human transcriber to transcribe  every syllable spoken, so the transcript will include things like disfluencies  (i.e. ‘umm’,’ah’) and false starts. When not specified or set to `false`, the transcribers will follow the  [Rev.com transcription style guide](https://cf-public.rev.com/styleguide/transcription/Rev+Transcription+Style+Guide+v4.0.1.pdf).

#### Segments to transcribe

Use the `segments_to_transcribe` parameter to specify which sections of the audio file need to be transcribed. Segments must be at least 1 minute in length and cannot overlap. The primary use case of this feature is to transcribe key segments of the audio, while ignoring the rest.

#### Speaker names

Use the `speaker_names` parameter to specify a list of speaker names to be given to the human transcriber. This list may be no more than 100 names long and each name is limited to 50 characters. Note that even though a name is provided, it may not necessarily be used, as the human transcriber still needs to be able to distinguish individual speaker voices from the provided audio.

#### Test mode

Set the `test_mode` parameter to `true` to mock a normal human transcription job. No transcription will happen in this case. The primary use case is to test integrations without being charged for human transcription.

Jobs submitted with this option will be in the `in_progress` state for a few minutes before completing and returning a dummy transcript.

<!-- Source: https://docs.rev.ai/api/asynchronous/reference.md -->

# Asynchronous Speech-To-Text API Documentation

Asynchronous Speech-To-Text API Documentation


Version: v1

## Servers

Rev AI API
```
https://api.rev.ai/speechtotext/v1
```

## Security

### AccessToken

Type: http
Scheme: bearer

## Download OpenAPI description

[Asynchronous Speech-To-Text API Documentation](https://docs.rev.ai/_bundle/api/asynchronous/reference.yaml)

## Jobs

### Get Job By Id

 - [GET /jobs/{id}](https://docs.rev.ai/api/asynchronous/reference/jobs/getjobbyid.md): Returns information about a transcription job

### Delete Job by Id

 - [DELETE /jobs/{id}](https://docs.rev.ai/api/asynchronous/reference/jobs/deletejobbyid.md): Deletes a transcription job. All data related to the job, such as input media and transcript, will be permanently deleted. A job can only be deleted once it's completed (either with success or failure).

### Get List of Jobs

 - [GET /jobs](https://docs.rev.ai/api/asynchronous/reference/jobs/getlistofjobs.md): Gets a list of transcription jobs submitted within the last 30 days in reverse chronological order up to the provided limit number of jobs per call. Note: Jobs older than 30 days will not be listed. Pagination is supported via passing the last job id from a previous call into starting_after.

### Submit Transcription Job

 - [POST /jobs](https://docs.rev.ai/api/asynchronous/reference/jobs/submittranscriptionjob.md): Starts an asynchronous job to transcribe speech-to-text for a media file. Media files can be specified in two ways, either by including a public url to the media in the transcription job options or by uploading a local file as part of a multipart/form request.

## Transcripts

### Get Transcript By Id

 - [GET /jobs/{id}/transcript](https://docs.rev.ai/api/asynchronous/reference/transcripts/gettranscriptbyid.md): Returns the transcript for a completed transcription job. Transcript can be returned as either JSON or plaintext format. Transcript output format can be specified in the Accept header. Returns JSON by default.
*
Note: For streaming jobs, transient failure of our storage during a live session may prevent the final hypothesis elements from saving properly, resulting in an incomplete transcript. This is rare, but not impossible. To guarantee 100% completeness, we recommend capturing all final hypothesis when you receive them on the client.

### Get Translated Transcript By Id

 - [GET /jobs/{id}/transcript/translation/{language}](https://docs.rev.ai/api/asynchronous/reference/transcripts/gettranslatedtranscriptbyid.md): Returns translated transcript for a completed transcription job. Translation must be requested as part of the submitted job. Transcript can be returned in either JSON or plaintext format. Transcript output format can be specified in the Accept header. Returns JSON by default.

### Get Transcript Summary By Id

 - [GET /jobs/{id}/transcript/summary](https://docs.rev.ai/api/asynchronous/reference/transcripts/gettranscriptsummarybyid.md): Returns the transcript summary for a completed transcription job. Summary can be returned as either JSON or plaintext format. Summary output format can be specified in the Accept header. Returns plaintext by default.

## Captions

### Get Captions

 - [GET /jobs/{id}/captions](https://docs.rev.ai/api/asynchronous/reference/captions/getcaptions.md): Returns the caption output for a transcription job. We currently support SubRip (SRT) and Web Video Text Tracks (VTT) output.
Caption output format can be specified in the Accept header. Returns SRT by default.
*
Note: For streaming jobs, transient failure of our storage during a live session may prevent the final hypothesis elements from saving properly, resulting in an incomplete caption file. This is rare, but not impossible.

### Get Translated Captions

 - [GET /jobs/{id}/captions/translation/{language}](https://docs.rev.ai/api/asynchronous/reference/captions/gettranslatedcaptions.md): Returns translated caption output for a transcription job. Translation must be requested as part of the submited job. We currently support SubRip (SRT) and Web Video Text Tracks (VTT) output.
Caption output format can be specified in the Accept header. Returns SRT by default.

## Accounts

### Get Account

 - [GET /account](https://docs.rev.ai/api/asynchronous/reference/accounts/getaccount.md): Get the developer's account information

<!-- Source: https://docs.rev.ai/api/asynchronous/best-practices.md -->

# Best Practices

This section is designed to provide guidelines for achieving the best speech-to-text results possible when using the API.

## File formats

Rev AI uses FFmpeg and therefore supports all the [file formats supported by FFmpeg](https://ffmpeg.org/general.html#File-Formats). This includes all common media formats, such as MP3, MP4, Ogg, WAV, PCM and FLAC and many more. For best results, use a lossless format such as FLAC or ALAC, or a lossy format like MP3 or AAC with a bitrate of 192 Kbps or above.

## Sampling rate

If you control the audio source, record at 16kHz sample rate or higher. We can transcribe audio as low as 8kHz as well. Do not up-sample or down-sample audio. Submit the audio in its original format.

## Multi-channel audio

For perfect speaker separation (speaker diarization), record each speaker on their own channel and submit the job using the `speaker_channels_count` parameter. If the speakers are recorded on a single channel, do not attempt to modify the recording; submit the file as is.

Speaker channels incur extra costs as outlined in the [Asynchronous Speech-to-Text API documentation](/api/asynchronous).

## Mono-compatible audio

Ensure stereo audio files do not contain phase cancellation between channels. Phase cancellation occurs when stereo channels have inverted polarity, causing audio to cancel out when mixed to mono during processing. This results in silence or severely reduced volume, producing incomplete or empty transcripts.

Test your audio in mono before submission. If content becomes inaudible or significantly quieter when both channels are combined, correct the phase relationship in your recording setup before transcribing.

## Pre-processed audio

Don't pre-process audio. This can distort the audio and reduce the transcript accuracy. Our speech engine is very robust and has been designed to handle a large variety of audio recordings.

## Uncommon words

To improve recognition of uncommon words, such as proper names and special technical terms, submit a list of these words as custom vocabulary along with your request. Read the [Custom Vocabulary API documentation](/api/custom-vocabulary/) for more details.

## Recording environment

When recording:

* Record in a quiet setting.
* Speak clearly, loudly, and slowly.
* Avoid talking over other people
* Use quality recording equipment, such as an external or dedicated microphone or recorder


## Support

To report errors or request assistance, contact the support team by email at [support@rev.ai](mailto:support@rev.ai). Always keep logs of failed jobs, including media files and unique job identifiers, as these will help the support team to investigate and resolve your issue.

<!-- Source: https://docs.rev.ai/sdk/node/get-started.md -->

# Get Started

This short tutorial will teach you the basics of using the Rev AI Node SDK. It demonstrates how to produce a transcript of an audio file submitted by you using the SDK.

## Assumptions

This tutorial assumes that:

- You have a Rev AI account and access token. If not, [sign up for a free account](https://www.rev.ai/auth/signup) and [generate an access token](/get-started#step-1-get-your-access-token).
- You have a properly configured Node development environment with a current version of Node. The Node SDK supports v8, v10, v12, v14, v16 and v17.


## Step 1: Install the SDK

Begin by installing the SDK:


```bash
npm install revai-node-sdk
```

## Step 2: Submit a file for transcription and retrieve the result

The following example demonstrates how to submit a local audio file for transcription.

To use this example, replace the `<FILEPATH>` placeholder with the path to the file you wish to transcribe and the `<REVAI_ACCESS_TOKEN>` placeholder with your Rev AI account's access token.


```javascript
// create a client
import { RevAiApiClient } from 'revai-node-sdk';

var accessToken = '<REVAI_ACCESS_TOKEN>';
var filePath = '<FILEPATH>';

// initialize the client with your access token
var client = new RevAiApiClient(accessToken);

// submit a local file
var job = await client.submitJobLocalFile(filePath);

// retrieve transcript
// as plain text
var transcriptText = await client.getTranscriptText(job.id);

// or as an object
var transcriptObject = await client.getTranscriptObject(job.id);
```

You can also submit a [remote file](/sdk/node/code-samples#submit-a-remote-file-for-transcription) or an [audio stream](/sdk/node/code-samples#submit-an-audio-stream-for-transcription).

The text output is a string containing just the text of your transcript. The object form of the transcript contains all the information outlined in the response of the [transcript retrieval endpoint of the Asynchronous Speech-to-Text API](/api/asynchronous) when using the JSON response schema.

Any of these outputs can also be retrieved as a stream for easy file writing:


```javascript
var textStream = await client.getTranscriptTextStream(job.id);
var transcriptStream = await client.getTranscriptObjectStream(job.id);
```

## Next steps

You should now have a basic understanding of how to use the Node SDK. To learn more, refer to the [SDK documentation](https://github.com/revdotcom/revai-node-sdk/blob/master/README.md) and [code samples](/sdk/node/code-samples).

<!-- Source: https://docs.rev.ai/sdk/node/code-samples.md -->

# Code Samples

Use the code samples below to quickly get started developing with the SDK.

These examples require the [Rev AI Node SDK](/sdk/node).

## Submit a local file for transcription

The following example demonstrates how to submit a local audio file for transcription.

To use this example, replace the `<FILEPATH>` placeholder with the path to the file you wish to transcribe and the `<REVAI_ACCESS_TOKEN>` placeholder with your Rev AI account's access token.


```javascript
// create a client
import { RevAiApiClient } from 'revai-node-sdk';

var accessToken = '<REVAI_ACCESS_TOKEN>';
var filePath = '<FILEPATH>';

// initialize the client with your access token
var client = new RevAiApiClient(accessToken);

// submit a local file
var job = await client.submitJobLocalFile(filePath);

// retrieve transcript
// as plain text
var transcriptText = await client.getTranscriptText(job.id);

// or as an object
var transcriptObject = await client.getTranscriptObject(job.id);
```

## Submit a remote file for transcription

The following example demonstrates how to submit a remote audio file for transcription.

To use this example, replace the `<URL>` placeholder with the public URL to the file you wish to transcribe and the `<REVAI_ACCESS_TOKEN>` placeholder with your Rev AI account's access token.


```javascript
import { RevAiApiClient } from 'revai-node-sdk';

var accessToken = '<REVAI_ACCESS_TOKEN>';
var sourceConfig = {url: '<URL>', auth_headers: null};
const jobOptions = {source_config: sourceConfig}

// initialize the client with your access token
var client = new RevAiApiClient(accessToken);

// submit via a public URL
var job = await client.submitJob(jobOptions);

// retrieve transcript
// as plain text
var transcriptText = await client.getTranscriptText(job.id);

// or as an object
var transcriptObject = await client.getTranscriptObject(job.id);
```

## Submit an audio stream for transcription

The following example demonstrates how to submit an audio stream for transcription.

To use this example, replace the `<FILEPATH>` placeholder with the path to the file you wish to transcribe and the `<REVAI_ACCESS_TOKEN>` placeholder with your Rev AI account's access token.


```javascript
import { RevAiApiClient } from 'revai-node-sdk';

var accessToken = '<REVAI_ACCESS_TOKEN>';
var filePath = '<FILEPATH>';

// initialize the client with your access token
var client = new RevAiApiClient(accessToken);

// submit as audio data, the filename is optional
const stream = fs.createReadStream(filePath);
var job = await client.submitJobAudioData(stream, 'file.mp3');

// retrieve transcript
// as plain text
var transcriptText = await client.getTranscriptText(job.id);

// or as an object
var transcriptObject = await client.getTranscriptObject(job.id);
```

## Stream a local file

The following example can be used to configure a streaming client, stream audio from a file, and obtain the transcript as the audio is processed.

To use this example, replace the `<FILEPATH>` placeholder with the path to the file you wish to transcribe and the `<REVAI_ACCESS_TOKEN>` placeholder with your Rev AI account's access token.


```javascript
const revai = require('revai-node-sdk');
const fs = require('fs');

const token = '<REVAI_ACCESS_TOKEN>';
const filePath = '<FILEPATH>';

// Initialize your client with your audio configuration and access token
const audioConfig = new revai.AudioConfig(
    /* contentType */ "audio/x-raw",
    /* layout */      "interleaved",
    /* sample rate */ 16000,
    /* format */      "S16LE",
    /* channels */    1
);

var client = new revai.RevAiStreamingClient(token, audioConfig);

// Create your event responses
client.on('close', (code, reason) => {
    console.log(`Connection closed, ${code}: ${reason}`);
});
client.on('httpResponse', code => {
    console.log(`Streaming client received http response with code: ${code}`);
})
client.on('connectFailed', error => {
    console.log(`Connection failed with error: ${error}`);
})
client.on('connect', connectionMessage => {
    console.log(`Connected with message: ${connectionMessage}`);
})

// Begin streaming session
var stream = client.start();

// Read file from disk
var file = fs.createReadStream(filePath);

stream.on('data', data => {
    console.log(data);
});
stream.on('end', function () {
    console.log("End of Stream");
});

file.on('end', () => {
    client.end();
});

// Stream the file
file.pipe(stream);

// Forcibly ends the streaming session
// stream.end();
```

## Stream and transcribe microphone audio

The following example can be used to configure your streaming client, send audio as a stream from your microphone input, and obtain the transcript as it is processed.

To use this example, replace the `<REVAI_ACCESS_TOKEN>` placeholder with your Rev AI access token.


```javascript
const revai = require('revai-node-sdk');
const mic = require('mic');

const token = '<REVAI_ACCESS_TOKEN>';

// initialize client with audio configuration and access token
const audioConfig = new revai.AudioConfig(
    /* contentType */ "audio/x-raw",
    /* layout */      "interleaved",
    /* sample rate */ 16000,
    /* format */      "S16LE",
    /* channels */    1
);

// initialize microphone configuration
// note: microphone device id differs
// from system to system and can be obtained with
// arecord --list-devices and arecord --list-pcms
const micConfig = {
    /* sample rate */ rate: 16000,
    /* channels */    channels: 1,
    /* device id */   device: 'hw:0,0'
};

var client = new revai.RevAiStreamingClient(token, audioConfig);

var micInstance = mic(micConfig);

// create microphone stream
var micStream = micInstance.getAudioStream();

// create event responses
client.on('close', (code, reason) => {
    console.log(`Connection closed, ${code}: ${reason}`);
});
client.on('httpResponse', code => {
    console.log(`Streaming client received http response with code: ${code}`);
});
client.on('connectFailed', error => {
    console.log(`Connection failed with error: ${error}`);
});
client.on('connect', connectionMessage => {
    console.log(`Connected with message: ${connectionMessage}`);
});
micStream.on('error', error => {
  console.log(`Microphone input stream error: ${error}`);
});

// begin streaming session
var stream = client.start();

// create event responses
stream.on('data', data => {
  console.log(data);
});
stream.on('end', function () {
  console.log("End of Stream");
});

// pipe the microphone audio to Rev AI client
micStream.pipe(stream);

// start the microphone
micInstance.start();

// Forcibly ends the streaming session
// stream.end();
```

## Recover from connection errors and timeouts during a stream

The following example can be used to configure a streaming client to transcribe a long-duration stream using a RAW-format audio file. It handles reconnects (whether due to session length timeouts or other connectivity interruption) without losing audio. It also re-aligns timestamp offsets to the new streaming session when reconnecting.

To use this example, replace the `<FILEPATH>` placeholder with the path to the audio file (RAW format) you wish to stream and the `<REVAI_ACCESS_TOKEN>` placeholder with your Rev AI account's access token.


```javascript
const fs = require('fs');
const revai = require('revai-node-sdk');
const { Writable } = require('stream');

const token = '<REVAI_ACCESS_TOKEN>';
const filePath = '<FILEPATH>';
const bytesPerSample = 2;
const samplesPerSecond = 16000;
const chunkSize = 8000;

// initialize client with audio configuration and access token
const audioConfig = new revai.AudioConfig(
    /* contentType */ 'audio/x-raw',
    /* layout */      'interleaved',
    /* sample rate */ samplesPerSecond,
    /* format */      'S16LE',
    /* channels */    1
);

// optional config to be provided.
const sessionConfig = new revai.SessionConfig(
    metadata='example metadata', /* (optional) metadata */
    customVocabularyID=null,  /* (optional) custom_vocabulary_id */
    filterProfanity=false,    /* (optional) filter_profanity */
    removeDisfluencies=false, /* (optional) remove_disfluencies */
    deleteAfterSeconds=0,     /* (optional) delete_after_seconds */
    startTs=0,                /* (optional) start_ts */
    transcriber='machine',    /* (optional) transcriber */
    detailedPartials=false,   /* (optional) detailed_partials */
    language="en"             /* (optional) language */
);

// begin streaming session
let client = null;
let revaiStream = null;

let audioBackup = [];
let audioBackupCopy = [];
let newStream = true;
let lastResultEndTsReceived = 0.0;

function handleData(data) {
    switch (data.type){
        case 'connected':
            console.log("Received connected");
            break;
        case 'partial':
            console.log(`Partial: ${data.elements.map(x => x.value).join(' ')}`);
            break;
        case 'final':
            console.log(`Final: ${data.elements.map(x => x.value).join('')}`);
            const textElements = data.elements.filter(x => x.type === "text");
            lastResultEndTsReceived = textElements[textElements.length - 1].end_ts;
            console.log(lastResultEndTsReceived * samplesPerSecond * bytesPerSample / 1024);
            break;
        default:
            // all messages from the API are expected to be one of the previous types
            console.error('Received unexpected message');
            break;
    }
}

function startStream() {
    client = new revai.RevAiStreamingClient(token, audioConfig);

    // create event responses
    client.on('close', (code, reason) => {
        console.log(`Connection closed, ${code}: ${reason}`);
        if (code !== 1000 || reason == 'Reached max session lifetime'){
            console.log('Restarting stream');
            restartStream();
        }
        console.log(bytesWritten);
    });
    client.on('httpResponse', code => {
        console.log(`Streaming client received HTTP response with code: ${code}`);
    });
    client.on('connectFailed', error => {
        console.log(`Connection failed with error: ${error}`);
    });
    client.on('connect', connectionMessage => {
        console.log(`Connected with job ID: ${connectionMessage.id}`);
    });

    audioBackup = [];
    sessionConfig.startTs = lastResultEndTsReceived;

    revaiStream = client.start(sessionConfig);
    revaiStream.on('data', data => {
        handleData(data);
    });
    revaiStream.on('end', function () {
        console.log('End of stream');
    });
}

let bytesWritten = 0;

const audioInputStreamTransform = new Writable({
    write(chunk, encoding, next) {
        if (newStream && audioBackupCopy.length !== 0) {
            // approximate math to calculate time of chunks
            const bitsSent = lastResultEndTsReceived * samplesPerSecond * bytesPerSample;
            const chunksSent = Math.floor(bitsSent / chunkSize);
            if (chunksSent !== 0) {
                for (let i = chunksSent; i < audioBackupCopy.length; i++) {
                    revaiStream.write(audioBackupCopy[i][0], audioBackupCopy[i][1]);
                }
            }
            newStream = false;
        }

        audioBackup.push([chunk, encoding]);

        if (revaiStream) {
            revaiStream.write(chunk, encoding);
            bytesWritten += chunk.length;
        }

        next();
    },

    final() {
        if (client && revaiStream) {
            client.end();
            revaiStream.end();
        }
    }
});

function restartStream() {
    if (revaiStream) {
        client.end();
        revaiStream.end();
        revaiStream.removeListener('data', handleData);
        revaiStream = null;
    }

    audioBackupCopy = [];
    audioBackupCopy = audioBackup;

    newStream = true;

    startStream();
}

// read file from disk
let file = fs.createReadStream(filePath);

startStream();

file.on('end', () => {
    chunkInputTransform.end();
})

// array for data left over from chunking writes into chunks of 8000
let leftOverData = null;

const chunkInputTransform = new Writable({
    write(chunk, encoding, next) {
        if (encoding !== 'buffer'){
            console.log(`${encoding} is not buffer, writing directly`);
            audioInputStreamTransform.write(chunk, encoding);
        }
        else {
            let position = 0;

            if (leftOverData != null) {
                let audioChunk = Buffer.alloc(chunkSize);
                const copiedAmount = leftOverData.length;
                console.log(`${copiedAmount} left over, writing with next chunk`);
                leftOverData.copy(audioChunk);
                leftOverData = null;
                chunk.copy(audioChunk, chunkSize - copiedAmount);
                position += chunkSize - copiedAmount;
                audioInputStreamTransform.write(audioChunk, encoding);
            }

            while(chunk.length - position > chunkSize) {
                console.log(`${chunk.length - position} bytes left in chunk, writing with next audioChunk`);
                let audioChunk = Buffer.alloc(chunkSize);
                chunk.copy(audioChunk, 0, position, position+chunkSize);
                position += chunkSize;
                audioInputStreamTransform.write(audioChunk, encoding);
            }

            if (chunk.length > 0) {
                leftOverData = Buffer.alloc(chunk.length - position);
                chunk.copy(leftOverData, 0, position);
            }
        }

        next();
    },

    final() {
        if (leftOverData != null) {
            audioInputStreamTransform.write(leftOverData);
            audioInputStreamTransform.end();
        }
    }
})

// stream the file
file.pipe(chunkInputTransform);
```

## Send email notifications using a webhook

The following example demonstrates how to implement a webhook handler that receives and parses the HTTP POST message from the Rev AI API and sends an email notification using Express and the Twilio SendGrid API client.

To use this example, you must first replace three placeholders:

- `<SENDER_EMAIL_ADDRESS>` and `<RECIPIENT_EMAIL_ADDRESS>` for the sender and recipient email addresses; and
- `<SENDGRID_API_KEY>` for the Twilio SendGrid API key.



```javascript
const bodyParser = require('body-parser');
const express = require('express');
const sendgrid = require('@sendgrid/mail');

// Twilio SendGrid API key
const sendgridKey = '<SENDGRID_API_KEY>';
// sender email address
const senderEmail = '<SENDER_EMAIL>';
// recipient email address
const receiverEmail = '<RECEIVER_EMAIL>';

// set API key for SendGrid
sendgrid.setApiKey(sendgridKey);

// create Express application
const app = express();
app.use(bodyParser.json());

// handle requests to webhook endpoint
app.post('/hook', async req => {
  const job = req.body.job;
  console.log(`Received status for job id ${job.id}: ${job.status}`);    

  const message = {
    from: senderEmail,
    to: receiverEmail,
    subject: `Job ${job.id} is COMPLETE`,
    text: job.status === 'transcribed'
        ? `Log in at https://rev.ai/jobs/speech-to-text/ to collect your transcript.`
        : `An error occurred. Log in at https://rev.ai/jobs/speech-to-text/ to view details.`
  };

  try {
    await sendgrid.send(message);
    console.log('Email successfully sent');
  } catch (e) {
    console.error(e);
  }

});

//  start application on port 3000
app.listen(3000, () => {
  console.log('Webhook listening');
})
```

## Save transcripts to MongoDB using a webhook

The following example demonstrates how to implement a webhook handler that receives and parses the HTTP POST message from the Rev AI API and then makes a subsequent request to the API to retrieve the complete transcript. The handler then saves the received data to a MongoDB database collection as a JSON document.

To use this example, you must replace the `<MONGODB_CONNECTION_URI>` with the [connection URI](https://www.mongodb.com/docs/manual/reference/connection-string/) to your MongoDB database and the `<REVAI_ACCESS_TOKEN>` placeholder with your Rev AI account's access token.


```javascript
const { RevAiApiClient } = require('revai-node-sdk');
const { MongoClient } = require('mongodb');
const bodyParser = require('body-parser');
const express = require('express');

// MongoDB connection string
const mongodbUri = '<MONGODB_CONNECTION_URI>';

// Rev AI access token
const revAiToken = '<REVAI_ACCESS_TOKEN>';

// create Express application
const app = express();
app.use(bodyParser.json());

// create Mongo client
const mongo = new MongoClient(mongodbUri);
mongo.connect();
const db = mongo.db('mydb');
const transcripts = db.collection('transcripts')

// create Rev AI API client
const revAiClient = new RevAiApiClient(revAiToken);

// handle requests to webhook endpoint
app.post('/hook', async req => {
  const job = req.body.job;
  console.log(`Received status for job id ${job.id}: ${job.status}`);

  if (job.status === 'transcribed') {
    // request transcript
    const transcript = await revAiClient.getTranscriptObject(job.id);
    console.log(`Received transcript for job id ${job.id}`);

    // create MongoDB document
    const doc = {
      job_id: job.id,
      created_on: job.created_on,
      language: job.language,
      status: job.status,
      transcript
    }

    // save document to MongoDB
    try {
      const result = await collection.insertOne(doc);
      console.log(`Saved transcript with document id: ${result.insertedId}`);
    } catch (e) {
      console.error(e);
    }
  }
});

//  start application on port 3000
app.listen(3000, () => {
  console.log('Webhook listening');
})
```

## Identify language for transcription using a webhook

The following example demonstrates a webhook handler that receives both language identification and transcription job results from the respective APIs. If the results are successful, it performs the following additional processing:

- For language identification jobs, it obtains the list of identified languages and the most probable language, and then initiates an asynchronous transcription request that includes this language information.
- For asynchronous transcription jobs, it obtains the final transcript and prints it to the console.


To use this example, replace the `<REVAI_ACCESS_TOKEN>` placeholder with your Rev AI account's access token.


```javascript
const { RevAiApiClient } = require('revai-node-sdk');
const bodyParser = require('body-parser');
const express = require('express');
const axios = require('axios');

const token = '<REVAI_ACCESS_TOKEN>';

// create Axios client
const http = axios.create({
  baseURL: 'https://api.rev.ai/',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});

// create Rev AI API client
const revAiClient = new RevAiApiClient(token);

const getLanguageIdentificationJobResult = async (jobId) => {
  return await http.get(`languageid/v1beta/jobs/${jobId}/result`,
    { headers: { 'Accept': 'application/vnd.rev.languageid.v1.0+json' } })
    .then(response => response.data)
    .catch(console.error);
};

// create Express application
const app = express();
app.use(bodyParser.json());

// define webhook handler
app.post('/hook', async req => {
  // get job, media URL, callback URL
  const job = req.body.job;
  const fileUrl = job.media_url;
  const callbackUrl = job.callback_url;
  console.log(`Received status for job id ${job.id}: ${job.status}`);

  try {
    switch (job.type) {
      // language job result handler
      case 'language_id':
        if (job.status === 'completed') {
          const languageJobResult = await getLanguageIdentificationJobResult(job.id);
          // retrieve most probable language
          // use as input to transcription request
          const languageId = languageJobResult.top_language;
          console.log(`Received result for job id ${job.id}: language '${languageId}'`);
          const transcriptJobSubmission = await revAiClient.submitJobUrl(fileUrl, {
            language: languageId,
            callback_url: callbackUrl
          });
          console.log(`Submitted for transcription with job id ${transcriptJobSubmission.id}`);
        }
        break;
      // transcription job result handler
      case 'async':
        if (job.status === 'transcribed') {
          // retrieve transcript
          const transcriptJobResult = await revAiClient.getTranscriptObject(job.id);
          console.log(`Received transcript for job id ${job.id}`);
          // do something with transcript
          // for example: print to console
          console.log(transcriptJobResult);
        }
        break;
    }
  } catch (e) {
    console.error(e);
  }
});


//  start application on port 3000
app.listen(3000, () => {
  console.log('Webhook listening');
})
```

Find [more examples on GitHub](https://github.com/revdotcom/revai-node-sdk/tree/master/examples).

<!-- Source: https://docs.rev.ai/resources/code-samples/node.md -->

# Node Code Samples

Use the Node code samples below to quickly get started developing with the Rev AI APIs.

## Submit a local file for transcription

This example uses the [Rev AI Node SDK](/sdk/node).

The following example demonstrates how to submit a local audio file for transcription.

To use this example, replace the `<FILEPATH>` placeholder with the path to the file you wish to transcribe and the `<REVAI_ACCESS_TOKEN>` placeholder with your Rev AI account's access token.


```javascript
// create a client
import { RevAiApiClient } from 'revai-node-sdk';

var accessToken = '<REVAI_ACCESS_TOKEN>';
var filePath = '<FILEPATH>';

// initialize the client with your access token
var client = new RevAiApiClient(accessToken);

// submit a local file
var job = await client.submitJobLocalFile(filePath);

// retrieve transcript
// as plain text
var transcriptText = await client.getTranscriptText(job.id);

// or as an object
var transcriptObject = await client.getTranscriptObject(job.id);
```

## Submit a remote file for transcription

This example uses the [Rev AI Node SDK](/sdk/node).

The following example demonstrates how to submit a remote audio file for transcription.

To use this example, replace the `<URL>` placeholder with the public URL to the file you wish to transcribe and the `<REVAI_ACCESS_TOKEN>` placeholder with your Rev AI account's access token.


```javascript
import { RevAiApiClient } from 'revai-node-sdk';

var accessToken = '<REVAI_ACCESS_TOKEN>';
var sourceConfig = {url: '<URL>', auth_headers: null};
const jobOptions = {source_config: sourceConfig}

// initialize the client with your access token
var client = new RevAiApiClient(accessToken);

// submit via a public URL
var job = await client.submitJob(jobOptions);

// retrieve transcript
// as plain text
var transcriptText = await client.getTranscriptText(job.id);

// or as an object
var transcriptObject = await client.getTranscriptObject(job.id);
```

## Calculate the average confidence score of a transcript

This example uses the [json-query package](https://www.npmjs.com/package/json-query).

The following example demonstrates how to calculate the average confidence score of a transcript.

To use this example, replace the `<FILEPATH>` placeholder with the path to the transcript file (in JSON format).


```javascript
// import required modules
const fs = require('fs');
const jsonQuery = require('json-query');

// define path to transcript JSON file
const transcriptFile = '<FILEPATH>';

// read file contents
// retrieve array with elements consisting of each {type: text} token
// as confidence scores are only available for text tokens
const transcript = JSON.parse(fs.readFileSync(transcriptFile));
const elements = jsonQuery('monologues.elements[**][*type=text]', {data: transcript}).value

// iterate over array
// calculate and print average confidence
var count = 0;
var confidenceSum = 0;
var confidenceAverage = 0;

elements.forEach(element => {
  confidenceSum += element.confidence;
  count++;
})

confidenceAverage = confidenceSum / count;

console.log(`Average confidence over ${count} items: ${confidenceAverage}`);
```

## Submit an audio stream for transcription

This example uses the [Rev AI Node SDK](/sdk/node).

The following example demonstrates how to submit an audio stream for transcription.

To use this example, replace the `<FILEPATH>` placeholder with the path to the file you wish to transcribe and the `<REVAI_ACCESS_TOKEN>` placeholder with your Rev AI account's access token.


```javascript
import { RevAiApiClient } from 'revai-node-sdk';

var accessToken = '<REVAI_ACCESS_TOKEN>';
var filePath = '<FILEPATH>';

// initialize the client with your access token
var client = new RevAiApiClient(accessToken);

// submit as audio data, the filename is optional
const stream = fs.createReadStream(filePath);
var job = await client.submitJobAudioData(stream, 'file.mp3');

// retrieve transcript
// as plain text
var transcriptText = await client.getTranscriptText(job.id);

// or as an object
var transcriptObject = await client.getTranscriptObject(job.id);
```

## Stream a local file

This example uses the [Rev AI Node SDK](/sdk/node).

The following example can be used to configure a streaming client, stream audio from a file, and obtain the transcript as the audio is processed.

To use this example, replace the `<FILEPATH>` placeholder with the path to the file you wish to transcribe and the `<REVAI_ACCESS_TOKEN>` placeholder with your Rev AI account's access token.


```javascript
const revai = require('revai-node-sdk');
const fs = require('fs');

const token = '<REVAI_ACCESS_TOKEN>';
const filePath = '<FILEPATH>';

// Initialize your client with your audio configuration and access token
const audioConfig = new revai.AudioConfig(
    /* contentType */ "audio/x-raw",
    /* layout */      "interleaved",
    /* sample rate */ 16000,
    /* format */      "S16LE",
    /* channels */    1
);

var client = new revai.RevAiStreamingClient(token, audioConfig);

// Create your event responses
client.on('close', (code, reason) => {
    console.log(`Connection closed, ${code}: ${reason}`);
});
client.on('httpResponse', code => {
    console.log(`Streaming client received http response with code: ${code}`);
})
client.on('connectFailed', error => {
    console.log(`Connection failed with error: ${error}`);
})
client.on('connect', connectionMessage => {
    console.log(`Connected with message: ${connectionMessage}`);
})

// Begin streaming session
var stream = client.start();

// Read file from disk
var file = fs.createReadStream(filePath);

stream.on('data', data => {
    console.log(data);
});
stream.on('end', function () {
    console.log("End of Stream");
});

file.on('end', () => {
    client.end();
});

// Stream the file
file.pipe(stream);

// Forcibly ends the streaming session
// stream.end();
```

## Stream and transcribe microphone audio

This example uses the [Rev AI Node SDK](/sdk/node) and the [mic package](https://www.npmjs.com/package/mic).

The following example can be used to configure your streaming client, send audio as a stream from your microphone input, and obtain the transcript as it is processed.

To use this example, replace the `<REVAI_ACCESS_TOKEN>` placeholder with your Rev AI access token.


```javascript
const revai = require('revai-node-sdk');
const mic = require('mic');

const token = '<REVAI_ACCESS_TOKEN>';

// initialize client with audio configuration and access token
const audioConfig = new revai.AudioConfig(
    /* contentType */ "audio/x-raw",
    /* layout */      "interleaved",
    /* sample rate */ 16000,
    /* format */      "S16LE",
    /* channels */    1
);

// initialize microphone configuration
// note: microphone device id differs
// from system to system and can be obtained with
// arecord --list-devices and arecord --list-pcms
const micConfig = {
    /* sample rate */ rate: 16000,
    /* channels */    channels: 1,
    /* device id */   device: 'hw:0,0'
};

var client = new revai.RevAiStreamingClient(token, audioConfig);

var micInstance = mic(micConfig);

// create microphone stream
var micStream = micInstance.getAudioStream();

// create event responses
client.on('close', (code, reason) => {
    console.log(`Connection closed, ${code}: ${reason}`);
});
client.on('httpResponse', code => {
    console.log(`Streaming client received http response with code: ${code}`);
});
client.on('connectFailed', error => {
    console.log(`Connection failed with error: ${error}`);
});
client.on('connect', connectionMessage => {
    console.log(`Connected with message: ${connectionMessage}`);
});
micStream.on('error', error => {
  console.log(`Microphone input stream error: ${error}`);
});

// begin streaming session
var stream = client.start();

// create event responses
stream.on('data', data => {
  console.log(data);
});
stream.on('end', function () {
  console.log("End of Stream");
});

// pipe the microphone audio to Rev AI client
micStream.pipe(stream);

// start the microphone
micInstance.start();

// Forcibly ends the streaming session
// stream.end();
```

## Recover from connection errors and timeouts during a stream

This example uses the [Rev AI Node SDK](/sdk/node).

The following example can be used to configure a streaming client to transcribe a long-duration stream using a RAW-format audio file. It handles reconnects (whether due to session length timeouts or other connectivity interruption) without losing audio. It also re-aligns timestamp offsets to the new streaming session when reconnecting.

To use this example, replace the `<FILEPATH>` placeholder with the path to the audio file (RAW format) you wish to stream and the `<REVAI_ACCESS_TOKEN>` placeholder with your Rev AI account's access token.


```javascript
const fs = require('fs');
const revai = require('revai-node-sdk');
const { Writable } = require('stream');

const token = '<REVAI_ACCESS_TOKEN>';
const filePath = '<FILEPATH>';
const bytesPerSample = 2;
const samplesPerSecond = 16000;
const chunkSize = 8000;

// initialize client with audio configuration and access token
const audioConfig = new revai.AudioConfig(
    /* contentType */ 'audio/x-raw',
    /* layout */      'interleaved',
    /* sample rate */ samplesPerSecond,
    /* format */      'S16LE',
    /* channels */    1
);

// optional config to be provided.
const sessionConfig = new revai.SessionConfig(
    metadata='example metadata', /* (optional) metadata */
    customVocabularyID=null,  /* (optional) custom_vocabulary_id */
    filterProfanity=false,    /* (optional) filter_profanity */
    removeDisfluencies=false, /* (optional) remove_disfluencies */
    deleteAfterSeconds=0,     /* (optional) delete_after_seconds */
    startTs=0,                /* (optional) start_ts */
    transcriber='machine',    /* (optional) transcriber */
    detailedPartials=false,   /* (optional) detailed_partials */
    language="en"             /* (optional) language */
);

// begin streaming session
let client = null;
let revaiStream = null;

let audioBackup = [];
let audioBackupCopy = [];
let newStream = true;
let lastResultEndTsReceived = 0.0;

function handleData(data) {
    switch (data.type){
        case 'connected':
            console.log("Received connected");
            break;
        case 'partial':
            console.log(`Partial: ${data.elements.map(x => x.value).join(' ')}`);
            break;
        case 'final':
            console.log(`Final: ${data.elements.map(x => x.value).join('')}`);
            const textElements = data.elements.filter(x => x.type === "text");
            lastResultEndTsReceived = textElements[textElements.length - 1].end_ts;
            console.log(lastResultEndTsReceived * samplesPerSecond * bytesPerSample / 1024);
            break;
        default:
            // all messages from the API are expected to be one of the previous types
            console.error('Received unexpected message');
            break;
    }
}

function startStream() {
    client = new revai.RevAiStreamingClient(token, audioConfig);

    // create event responses
    client.on('close', (code, reason) => {
        console.log(`Connection closed, ${code}: ${reason}`);
        if (code !== 1000 || reason == 'Reached max session lifetime'){
            console.log('Restarting stream');
            restartStream();
        }
        console.log(bytesWritten);
    });
    client.on('httpResponse', code => {
        console.log(`Streaming client received HTTP response with code: ${code}`);
    });
    client.on('connectFailed', error => {
        console.log(`Connection failed with error: ${error}`);
    });
    client.on('connect', connectionMessage => {
        console.log(`Connected with job ID: ${connectionMessage.id}`);
    });

    audioBackup = [];
    sessionConfig.startTs = lastResultEndTsReceived;

    revaiStream = client.start(sessionConfig);
    revaiStream.on('data', data => {
        handleData(data);
    });
    revaiStream.on('end', function () {
        console.log('End of stream');
    });
}

let bytesWritten = 0;

const audioInputStreamTransform = new Writable({
    write(chunk, encoding, next) {
        if (newStream && audioBackupCopy.length !== 0) {
            // approximate math to calculate time of chunks
            const bitsSent = lastResultEndTsReceived * samplesPerSecond * bytesPerSample;
            const chunksSent = Math.floor(bitsSent / chunkSize);
            if (chunksSent !== 0) {
                for (let i = chunksSent; i < audioBackupCopy.length; i++) {
                    revaiStream.write(audioBackupCopy[i][0], audioBackupCopy[i][1]);
                }
            }
            newStream = false;
        }

        audioBackup.push([chunk, encoding]);

        if (revaiStream) {
            revaiStream.write(chunk, encoding);
            bytesWritten += chunk.length;
        }

        next();
    },

    final() {
        if (client && revaiStream) {
            client.end();
            revaiStream.end();
        }
    }
});

function restartStream() {
    if (revaiStream) {
        client.end();
        revaiStream.end();
        revaiStream.removeListener('data', handleData);
        revaiStream = null;
    }

    audioBackupCopy = [];
    audioBackupCopy = audioBackup;

    newStream = true;

    startStream();
}

// read file from disk
let file = fs.createReadStream(filePath);

startStream();

file.on('end', () => {
    chunkInputTransform.end();
})

// array for data left over from chunking writes into chunks of 8000
let leftOverData = null;

const chunkInputTransform = new Writable({
    write(chunk, encoding, next) {
        if (encoding !== 'buffer'){
            console.log(`${encoding} is not buffer, writing directly`);
            audioInputStreamTransform.write(chunk, encoding);
        }
        else {
            let position = 0;

            if (leftOverData != null) {
                let audioChunk = Buffer.alloc(chunkSize);
                const copiedAmount = leftOverData.length;
                console.log(`${copiedAmount} left over, writing with next chunk`);
                leftOverData.copy(audioChunk);
                leftOverData = null;
                chunk.copy(audioChunk, chunkSize - copiedAmount);
                position += chunkSize - copiedAmount;
                audioInputStreamTransform.write(audioChunk, encoding);
            }

            while(chunk.length - position > chunkSize) {
                console.log(`${chunk.length - position} bytes left in chunk, writing with next audioChunk`);
                let audioChunk = Buffer.alloc(chunkSize);
                chunk.copy(audioChunk, 0, position, position+chunkSize);
                position += chunkSize;
                audioInputStreamTransform.write(audioChunk, encoding);
            }

            if (chunk.length > 0) {
                leftOverData = Buffer.alloc(chunk.length - position);
                chunk.copy(leftOverData, 0, position);
            }
        }

        next();
    },

    final() {
        if (leftOverData != null) {
            audioInputStreamTransform.write(leftOverData);
            audioInputStreamTransform.end();
        }
    }
})

// stream the file
file.pipe(chunkInputTransform);
```

## Send email notifications using a webhook

This example uses the [Rev AI Node SDK](/sdk/node), the [Twilio SendGrid Node package](https://www.npmjs.com/package/@sendgrid/mail) and the [Express framework](https://expressjs.com/).

The following example demonstrates how to implement a webhook handler that receives and parses the HTTP POST message from the Rev AI API and sends an email notification using Express and the Twilio SendGrid API client.

To use this example, you must first replace three placeholders:

- `<SENDER_EMAIL_ADDRESS>` and `<RECIPIENT_EMAIL_ADDRESS>` for the sender and recipient email addresses; and
- `<SENDGRID_API_KEY>` for the Twilio SendGrid API key.



```javascript
const bodyParser = require('body-parser');
const express = require('express');
const sendgrid = require('@sendgrid/mail');

// Twilio SendGrid API key
const sendgridKey = '<SENDGRID_API_KEY>';
// sender email address
const senderEmail = '<SENDER_EMAIL>';
// recipient email address
const receiverEmail = '<RECEIVER_EMAIL>';

// set API key for SendGrid
sendgrid.setApiKey(sendgridKey);

// create Express application
const app = express();
app.use(bodyParser.json());

// handle requests to webhook endpoint
app.post('/hook', async req => {
  const job = req.body.job;
  console.log(`Received status for job id ${job.id}: ${job.status}`);    

  const message = {
    from: senderEmail,
    to: receiverEmail,
    subject: `Job ${job.id} is COMPLETE`,
    text: job.status === 'transcribed'
        ? `Log in at https://rev.ai/jobs/speech-to-text/ to collect your transcript.`
        : `An error occurred. Log in at https://rev.ai/jobs/speech-to-text/ to view details.`
  };

  try {
    await sendgrid.send(message);
    console.log('Email successfully sent');
  } catch (e) {
    console.error(e);
  }

});

//  start application on port 3000
app.listen(3000, () => {
  console.log('Webhook listening');
})
```

## Save transcripts to MongoDB using a webhook

This example uses the [Rev AI Node SDK](/sdk/node), the [MongoDB Node.js Driver](https://mongodb.github.io/node-mongodb-native/) and the [Express framework](https://expressjs.com/).

The following example demonstrates how to implement a webhook handler that receives and parses the HTTP POST message from the Rev AI API and then makes a subsequent request to the API to retrieve the complete transcript. The handler then saves the received data to a MongoDB database collection as a JSON document.

To use this example, you must replace the `<MONGODB_CONNECTION_URI>` with the [connection URI](https://www.mongodb.com/docs/manual/reference/connection-string/) to your MongoDB database and the `<REVAI_ACCESS_TOKEN>` placeholder with your Rev AI account's access token.


```javascript
const { RevAiApiClient } = require('revai-node-sdk');
const { MongoClient } = require('mongodb');
const bodyParser = require('body-parser');
const express = require('express');

// MongoDB connection string
const mongodbUri = '<MONGODB_CONNECTION_URI>';

// Rev AI access token
const revAiToken = '<REVAI_ACCESS_TOKEN>';

// create Express application
const app = express();
app.use(bodyParser.json());

// create Mongo client
const mongo = new MongoClient(mongodbUri);
mongo.connect();
const db = mongo.db('mydb');
const transcripts = db.collection('transcripts')

// create Rev AI API client
const revAiClient = new RevAiApiClient(revAiToken);

// handle requests to webhook endpoint
app.post('/hook', async req => {
  const job = req.body.job;
  console.log(`Received status for job id ${job.id}: ${job.status}`);

  if (job.status === 'transcribed') {
    // request transcript
    const transcript = await revAiClient.getTranscriptObject(job.id);
    console.log(`Received transcript for job id ${job.id}`);

    // create MongoDB document
    const doc = {
      job_id: job.id,
      created_on: job.created_on,
      language: job.language,
      status: job.status,
      transcript
    }

    // save document to MongoDB
    try {
      const result = await collection.insertOne(doc);
      console.log(`Saved transcript with document id: ${result.insertedId}`);
    } catch (e) {
      console.error(e);
    }
  }
});

//  start application on port 3000
app.listen(3000, () => {
  console.log('Webhook listening');
})
```

## Identify language for transcription using a webhook

This example uses the [Rev AI Node SDK](/sdk/node) and the [Express framework](https://expressjs.com/).

The following example demonstrates a webhook handler that receives both language identification and transcription job results from the respective APIs. If the results are successful, it performs the following additional processing:

- For language identification jobs, it obtains the list of identified languages and the most probable language, and then initiates an asynchronous transcription request that includes this language information.
- For asynchronous transcription jobs, it obtains the final transcript and prints it to the console.


To use this example, replace the `<REVAI_ACCESS_TOKEN>` placeholder with your Rev AI account's access token.


```javascript
const { RevAiApiClient } = require('revai-node-sdk');
const bodyParser = require('body-parser');
const express = require('express');
const axios = require('axios');

const token = '<REVAI_ACCESS_TOKEN>';

// create Axios client
const http = axios.create({
  baseURL: 'https://api.rev.ai/',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});

// create Rev AI API client
const revAiClient = new RevAiApiClient(token);

const getLanguageIdentificationJobResult = async (jobId) => {
  return await http.get(`languageid/v1beta/jobs/${jobId}/result`,
    { headers: { 'Accept': 'application/vnd.rev.languageid.v1.0+json' } })
    .then(response => response.data)
    .catch(console.error);
};

// create Express application
const app = express();
app.use(bodyParser.json());

// define webhook handler
app.post('/hook', async req => {
  // get job, media URL, callback URL
  const job = req.body.job;
  const fileUrl = job.media_url;
  const callbackUrl = job.callback_url;
  console.log(`Received status for job id ${job.id}: ${job.status}`);

  try {
    switch (job.type) {
      // language job result handler
      case 'language_id':
        if (job.status === 'completed') {
          const languageJobResult = await getLanguageIdentificationJobResult(job.id);
          // retrieve most probable language
          // use as input to transcription request
          const languageId = languageJobResult.top_language;
          console.log(`Received result for job id ${job.id}: language '${languageId}'`);
          const transcriptJobSubmission = await revAiClient.submitJobUrl(fileUrl, {
            language: languageId,
            callback_url: callbackUrl
          });
          console.log(`Submitted for transcription with job id ${transcriptJobSubmission.id}`);
        }
        break;
      // transcription job result handler
      case 'async':
        if (job.status === 'transcribed') {
          // retrieve transcript
          const transcriptJobResult = await revAiClient.getTranscriptObject(job.id);
          console.log(`Received transcript for job id ${job.id}`);
          // do something with transcript
          // for example: print to console
          console.log(transcriptJobResult);
        }
        break;
    }
  } catch (e) {
    console.error(e);
  }
});


//  start application on port 3000
app.listen(3000, () => {
  console.log('Webhook listening');
})
```

## Submit JSON data for topic extraction

This example uses the [Axios HTTP client](https://axios-http.com/).

The following example demonstrates how to submit a JSON transcript for topic extraction using the Axios HTTP client.

To use this example, set the `<REVAI_ACCESS_TOKEN>` variable to your Rev AI account's access token.


```javascript
const axios = require('axios');
const token = '<REVAI_ACCESS_TOKEN>';

// create a client
const http = axios.create({
  baseURL: 'https://api.rev.ai/topic_extraction/v1/',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});

// submit a POST request
const submitTopicExtractionJobJson = async (jsonData) => {
  return await http.post(`jobs`,
    JSON.stringify({
      json: jsonData
    }))
    .then(response => response.data)
    .catch(console.error);
};
```

## Submit plaintext data for topic extraction

This example uses the [Axios HTTP client](https://axios-http.com/).

The following example demonstrates how to submit a plaintext transcript for topic extraction using the Axios HTTP client.

To use this example, set the `<REVAI_ACCESS_TOKEN>` variable to your Rev AI account's access token.


```javascript
const axios = require('axios');
const token = '<REVAI_ACCESS_TOKEN>';

// create a client
const http = axios.create({
  baseURL: 'https://api.rev.ai/topic_extraction/v1/',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});

// submit a POST request
const submitTopicExtractionJobText = async (textData) => {
  return await http.post(`jobs`,
    JSON.stringify({
      text: textData
    }))
    .then(response => response.data)
    .catch(console.error);
};
```

## Check the status of a topic extraction job

This example uses the [Axios HTTP client](https://axios-http.com/).

The following example demonstrates how to retrieve the status of a topic extraction job using the Axios HTTP client.

To use this example, set the `<REVAI_ACCESS_TOKEN>` variable to your Rev AI account's access token.


```javascript
const axios = require('axios');
const token = '<REVAI_ACCESS_TOKEN>';

// create a client
const http = axios.create({
  baseURL: 'https://api.rev.ai/topic_extraction/v1/',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});

// submit a GET request
const getTopicExtractionJobStatus = async (jobId) => {
  return await http.get(`jobs/${jobId}`)
    .then(response => response.data)
    .catch(console.error);
};
```

## Retrieve a topic extraction report

This example uses the [Axios HTTP client](https://axios-http.com/).

The following example demonstrates how to retrieve the result of a topic extraction job using the Axios HTTP client.

To use this example, set the `<REVAI_ACCESS_TOKEN>` variable to your Rev AI account's access token.


```javascript
const axios = require('axios');
const token = '<REVAI_ACCESS_TOKEN>';

// create a client
const http = axios.create({
  baseURL: 'https://api.rev.ai/topic_extraction/v1/',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});

// submit a GET request
const getTopicExtractionJobResult = async (jobId) => {
  return await http.get(`jobs/${jobId}/result`,
    { headers: { 'Accept': 'application/vnd.rev.topic.v1.0+json' } })
    .then(response => response.data)
    .catch(console.error);
};
```

## Submit JSON data for sentiment analysis

This example uses the [Axios HTTP client](https://axios-http.com/).

The following example demonstrates how to submit a JSON transcript for sentiment analysis using the Axios HTTP client.

To use this example, set the `<REVAI_ACCESS_TOKEN>` placeholder to your Rev AI account's access token.


```javascript
const axios = require('axios');
const token = '<REVAI_ACCESS_TOKEN>';

// create a client
const http = axios.create({
  baseURL: 'https://api.rev.ai/sentiment_analysis/v1/',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});

// submit a POST request
const submitSentimentAnalysisJobJson = async (jsonData) => {
  return await http.post(`jobs`,
    JSON.stringify({
      json: jsonData
    }))
    .then(response => response.data)
    .catch(console.error);
};
```

## Submit plaintext data for sentiment analysis

This example uses the [Axios HTTP client](https://axios-http.com/).

The following example demonstrates how to submit a plaintext transcript for sentiment analysis using the Axios HTTP client.

To use this example, set the `<REVAI_ACCESS_TOKEN>` placeholder to your Rev AI account's access token.


```javascript
const axios = require('axios');
const token = '<REVAI_ACCESS_TOKEN>';

// create a client
const http = axios.create({
  baseURL: 'https://api.rev.ai/sentiment_analysis/v1/',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});

// submit a POST request
const submitSentimentAnalysisJobText = async (textData) => {
  return await http.post(`jobs`,
    JSON.stringify({
      text: textData
    }))
    .then(response => response.data)
    .catch(console.error);
};
```

## Check the status of a sentiment analysis job

This example uses the [Axios HTTP client](https://axios-http.com/).

The following example demonstrates how to retrieve the status of a sentiment analysis job using the Axios HTTP client.

To use this example, set the `<REVAI_ACCESS_TOKEN>` placeholder to your Rev AI account's access token.


```javascript
const axios = require('axios');
const token = '<REVAI_ACCESS_TOKEN>';

// create a client
const http = axios.create({
  baseURL: 'https://api.rev.ai/sentiment_analysis/v1/',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});

// submit a GET request
const getSentimentAnalysisJobStatus = async (jobId) => {
  return await http.get(`jobs/${jobId}`)
    .then(response => response.data)
    .catch(console.error);
};
```

## Retrieve a sentiment analysis report

This example uses the [Axios HTTP client](https://axios-http.com/).

The following example demonstrates how to retrieve the result of a sentiment analysis job using the Axios HTTP client.

To use this example, set the `<REVAI_ACCESS_TOKEN>` placeholder to your Rev AI account's access token.


```javascript
const axios = require('axios');
const token = '<REVAI_ACCESS_TOKEN>';

// create a client
const http = axios.create({
  baseURL: 'https://api.rev.ai/sentiment_analysis/v1/',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});

// submit a GET request
const getSentimentAnalysisJobResult = async (jobId) => {
  return await http.get(`jobs/${jobId}/result`,
    { headers: { 'Accept': 'application/vnd.rev.sentiment.v1.0+json' } })
    .then(response => response.data)
    .catch(console.error);
};
```

Find [more examples of using the Rev AI Node SDK on GitHub](https://github.com/revdotcom/revai-node-sdk/tree/master/examples).

<!-- Source: https://docs.rev.ai/faq.md -->

# Frequently Asked Questions

Languages
Transcription
Deployment
Security
## Languages

### What languages does Rev AI support?

Rev AI supports 58+ languages in the Asynchronous Speech-to-Text API and 9+ languages in the Streaming Speech-to-Text API. New languages are frequently added. Please refer to the [current list of supported languages](https://www.rev.ai/languages).

### Is there a way to transcribe from one language to another (automatic translation)?

Yes. You can specify `translation_config` parameter when submitting a job. Learn more about [Asynchronous Speech-to-Text API](/api/asynchronous).

## Transcription

### How are long pauses in speech represented in the transcript?

This depends on the exact pause length but usually, a long pause will cause the transcript to start a new paragraph when speech resumes. Pauses are indicated by the timestamps on the words around them. There will be a jump in timestamps on the words around the pause.

### Are there limits on the number of jobs that can be processed concurrently?

The following default limits apply per user, per endpoint for the Asynchronous Speech-to-Text API:

- 10,000 transcription requests submitted every 10 minutes.
- 500 transcriptions processed every 10 minutes. Any submissions over this will be accepted but put into a queue and not started until the next interval.
- Maximum audio duration of 17 hours.
- File uploads submitted as `multipart/form-data` requests to the `/jobs` endpoint have a concurrency limit of 5 and a file size limit of 2 GB per request.
- File uploads via the Rev AI dashboard or using the `source_config` job parameter have a file size limit of 5 TB.


These limits are adjustable by Rev AI support.

### What type of media files does Rev AI support?

Rev AI uses FFmpeg and therefore supports all the [file formats supported by FFmpeg](https://ffmpeg.org/general.html#File-Formats). This includes all common media formats, such as MP3, MP4, Ogg, WAV, PCM and FLAC and many more.

### What is the maximum allowed file size and audio duration?

The maximum allowed file size depends on the submission method. If uploading a local file to the Rev AI server from the host machine as a `multipart/form-data` request, there is a file size limit of 2 GB per request. If uploading a local file via the Rev AI dashboard or submitting via the `source_config` job parameter, there is a file size limit of 5 TB. [Learn more about file submission methods](/api/asynchronous/files).

The maximum allowed audio length is 17 hours. For audio longer than 17 hours, it is necessary to split the audio file into chunks smaller than 17 hours and have them individually transcribed.

### Are there limits on the number of streams that can be processed concurrently?

The following limits are in place for the Streaming Speech-to-Text API:

- Streaming concurrency limit is 10.
- Time limit per stream is 3 hours.


Job queuing is not supported. If a job is submitted while a user is at the concurrency limit, the API will return a 4029 error.

The streaming concurrency limit is adjustable by Rev AI support.

### What if my stream is longer than 3 hours?

When your stream approaches the 3-hour limit, you should initialize a new concurrent WebSocket connection. Once your WebSocket connection is accepted and the `"connected"` type message is received, switch to the new WebSocket and begin streaming audio to it. Learn more in our [tutorial on recovering from connection errors and timeouts in Rev AI streaming transcription sessions](/resources/tutorials/recover-connection-streaming-api)

### Does Rev AI support RTMP streams?

Yes. Refer to the [Streaming Speech-to-Text API documentation for RTMP streams](/api/streaming#rtmp-streams).

### Are there daily or weekly limits?

There are no daily or weekly limits.

### Is there a time limit for processing individual jobs?

Yes, there are maximum job processing timeouts which differ for each type of job. There is also a maximum transcription time limit per job.

### How long will my jobs be accessible on the Rev AI server?

Jobs remain accessible on the server for 30 days after completion unless the account is [configured for a shorter auto-deletion period](/resources/tutorials/delete-user-files).

### Can I submit multi-track audio files?

Yes. Rev AI accepts most audio and video formats. Each track can be transcribed separately.

### What punctuation labels does Rev AI support?

Rev AI outputs three punctuation labels: commas (`,`), periods (`.`) and question marks(`?`).

### What is the maximum number of speakers supported?

Rev AI supports 8 speakers for English-language transcription and 6 for non English transcription.

### Is it possible to explicitly specify or limit the number of detected speakers?

There is currently no way to specify or limit the number of speakers. If each speaker is recorded on a separate channel, then the user can specify the total number of unique speaker channels in the audio via the `speaker_channels_count` option in the Asynchronous Speech-to-Text API.

### Does Rev AI support speaker identification?

*Speaker diarization* is the process of detecting speaker switches in audio and assigning transcript segments to individual speakers with generic speaker labels such as "Speaker 1" and "Speaker 2".

*Speaker identification* is the process of identifying individual voices and assigning identities to each in the transcript.

Rev AI supports speaker diarization but does not support speaker identification. Although specific speakers are not identified, Rev AI is able to detect speaker switches and represent them in the transcript with numbered speaker labels. For example, if Anna speaks and then Sarah speaks, the API detects the speaker switch and labels the voices as "Speaker 1" and "Speaker 2".

### Are any parameters available to control speaker assignment for audio segments?

No. If speakers are not being correctly assigned, note that speaker assignment can be affected by short utterances or variations in audio and other variables.

### Can I automatically turn Rev AI off if there's long periods of silence?

No.

### Can I use Rev AI for dictation?

Rev AI is not a dictation service. This means that Rev AI will not transcribe words such as "comma" and "period" to their respective symbols. If you are looking for a reader-friendly, well-formatted transcript where you can view/toggle the audio along with the transcript, we recommend using our [automated transcription service](https://www.rev.com/services/auto-audio-transcription).

### Is it possible to add words to the custom vocabulary after initial submission?

No. There is currently no API endpoint to update a custom vocabulary list. However, you can create an infinite number of custom vocabularies without needing to delete or update existing ones.

### How many custom vocabulary terms can I include?

Up to 6000 phrases may be submitted per transcription job for English, and up to 1000 for other languages. We recommend submitting a short list of target terms (no more than 500 phrases) as large lists may negatively impact performance and accuracy. Short phrases also do better than long phrases, so keep your phrases on the short side if possible. For more information, refer to the Custom Vocabulary [API limits](/api/custom-vocabulary#api-limits) and [general rules](/api/custom-vocabulary#general-rules).

### How long until my transcript is available?

You can usually expect your transcript to be available within 15 minutes of submitting your media file to our Asynchronous Speech-to-Text API. Most often, it will be available in less than 15 minutes, especially if your media is short duration.

### For faster results, can I skip some steps of the transcription process?

Yes. Use the `skip_postprocessing` parameter to skip some steps (inverse text normalization or ITN, casing and punctuation) of a transcription job. This parameter is useful to reduce the time taken for a transcription job, or to provide greater control over transcription output. The `skip_postprocessing` parameter is available for both the Asynchronous Speech-to-Text API and the [Streaming Speech-to-Text API](/api/streaming/requests).

### What does the score in a sentiment analysis report represent?

The score in a sentiment analysis report represents the intensity or strength of the sentiment. It is not a confidence score. This score is always a value in the range [-1, 1]. A score below -0.3 indicates a negative (sad/angry) sentiment, while a score above 0.3 indicates a positive (joyful/happy) sentiment. Scores in the range [-0.3, 0.3] indicate neutral sentiment.

## Deployment

### Can I use any database or backend with Rev AI?

Yes.

### Are there limits on the number of users who can use Rev AI in my application?

No.

### Can I deploy Rev AI on-premise?

Rev AI's world-class speech engine is available on-premise in the form of a Docker container. It can run Rev AI's asynchronous speech-to-text on recorded media and is deployable in any Docker supported environment. [Learn more about Asynchronous
Speech-To-Text On-Premise](https://public-rev.s3-us-west-2.amazonaws.com/revai/Rev+AI+Speech+to+Text+On-Premises.pdf) or [contact us](/feedback).

### What are the technical requirements for on-premise deployment?

Hardware requirements will vary depending on the number of transcriptions to be processed concurrently  and the length of the audio.

Base configuration for processing a single transcription up to 1 hour in length:

* 1 CPU
* 7.5 GB RAM for processing audio lengths up to 1 hour
* 9.03 GB + 650 MB of available disk space


Hardware:

* 1 CPU per concurrent audio file being transcribed
* 7.5 GB RAM as a base, transcribing a single file up to 1 hour in length
* For each additional concurrent transcription add 1.5 GB.
* For each additional audio hour in file length add 1.5 GB.


Storage:

* 9.03 GB image size
* 650 MB container size while processing a single transcription up to 1 hour in length
* For each additional concurrent transcription add 650 MB.
* For each additional audio hour in file length add 650 MB.
* Longer audio files require more storage for processing. Container size will vary depending on: the size of the file being transcribed, length of the audio and number of concurrent transcriptions.
* All files created during processing are deleted when the transcript is completed.


## Security

### How many access tokens can I have?

You are allowed a maximum of 2 access tokens at a time.

### Do I need different access tokens for different applications?

This is only required for applications which are to be billed separately. This is recommended when the customer has multiple environments or applications.

### Is Rev AI HIPAA-compliant?

Yes. Learn more about [Rev AI's HIPAA compliance](/api/hipaa).

### Do I need to do anything to make sure my account is HIPAA-enabled?

In order for the Rev AI team to make sure your account and data sent through your account is HIPAA-enabled (and thus protected), you must sign our Business Associate Agreement (BAA) and an updated MSA. This BAA is an explicit agreement to make sure that both parties understand the responsibilities and contingencies associated with processing data which may contain PHI.

Once you have reviewed and signed the BAA and updated MSA:

* Create a new Rev AI account that you will use for HIPAA-enabled orders.
* Send your new Rev AI account information to your sales contact.
* Rev AI will update your account to enable HIPAA-compliant processing and notify you when this is complete.
* Confirm your account is HIPAA-enabled by visiting [`https://rev.ai/account`](https://rev.ai/account).


Once the BAA has been executed and your account has been updated, your account will be ready to process PHI.

Learn more about [Rev AI's HIPAA compliance](/api/hipaa).

### Once my account is HIPAA-enabled, are there any changes to how I should submit API jobs?

Once your account is HIPAA-enabled, there are no changes to how you should submit API jobs, as your compliance configuration is done at the account level  and not at job level.

## Still have questions?

[Visit the Help Center](https://help.rev.ai/)

[Contact us](/feedback)
