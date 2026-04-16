<!-- Source: https://docs.z.ai/guides/overview/overview.md -->

> ## Documentation Index
> Fetch the complete documentation index at: https://docs.z.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Overview

<Info>
  Z.AI offers a variety of models and agents to meet the needs of different scenarios. Choosing the right model can help you complete tasks more efficiently.
</Info>

## Featured Models

<CardGroup cols={3}>
  <Card title="GLM-5.1" icon="book-open" href="/guides/llm/glm-5.1">
    SOTA Open-source Coding Capabilities <br />Significant Gains on Long-Horizon Tasks
  </Card>

  <Card title="GLM-5V-Turbo" icon="eyes" href="/guides/vlm/glm-5v-turbo">
    Multimodal coding model, specializing in visual programming.
  </Card>

  <Card title="GLM-Image" icon="image" href="/guides/image/glm-image">
    Supports text-to-image generation, achieving open-source state-of-the-art (SOTA) in complex scenarios
  </Card>
</CardGroup>

## Models, Agents and Tools

To help you find the best fit for your use case, we've created a table outlining the core features and strengths of each model in the Z.AI family.

<Tip>
  If you need to get pricing information, please go directly to [Pricing](/guides/overview/pricing).
</Tip>

### Text Models

Our model matrix includes text models with built-in reasoning capabilities, as well as vision-language models (VLMs) that extend the same reasoning power to multimodal understanding.

| Model               | Strength                                                                                                                        | Language          | Context | Resource                                                                                                |
| :------------------ | :------------------------------------------------------------------------------------------------------------------------------ | :---------------- | :------ | :------------------------------------------------------------------------------------------------------ |
| GLM-5.1             | Coding proficiency aligned with Opus 4.6<br />Ability to work independently and consistently for up to 8 hours on a single task | English & Chinese | 200K    | [Guide](/guides/llm/glm-5.1)<br /><br />[API Reference](/api-reference/llm/chat-completion)             |
| GLM-5               | Programming ability<br />Agentic Long-Term Planning and Execution<br />Backend refactoring and in-depth debugging               | English & Chinese | 200K    | [Guide](/guides/llm/glm-5)<br /><br />[API Reference](/api-reference/llm/chat-completion)               |
| GLM-5-Turbo         | Optimization of Core Requirements for OpenClaw Tasks<br />Improved continuity in the execution of complex tasks                 | English & Chinese | 200K    | [Guide](/guides/llm/glm-5-turbo)<br /><br />[API Reference](/api-reference/llm/chat-completion)         |
| GLM-4.7             | SOTA Performance<br />Enhanced General Capabilities<br />Optimized Agentic Coding                                               | English & Chinese | 200K    | [Guide](/guides/llm/glm-4.7)<br /><br />[API Reference](/api-reference/llm/chat-completion)             |
| GLM-4.7-FlashX      | Enhanced General Capabilities<br />Optimized Agentic Coding<br />Lightweight & High-Speed                                       | English & Chinese | 200K    | [Guide](/guides/llm/glm-4.7)<br /><br />[API Reference](/api-reference/llm/chat-completion)             |
| GLM-4.6             | High Performance<br />Strong Coding<br />More Versatile                                                                         | English & Chinese | 200K    | [Guide](/guides/llm/glm-4.6)<br /><br />[API Reference](/api-reference/llm/chat-completion)             |
| GLM-4.5             | Better Performance<br />Strong Reasoning<br />More Versatile                                                                    | English & Chinese | 128K    | [Guide](/guides/llm/glm-4.5)<br /><br />[API Reference](/api-reference/llm/chat-completion)             |
| GLM-4.5-X           | Good Performance<br />Strong Reasoning<br />Ultra-Fast Response                                                                 | English & Chinese | 128K    | [Guide](/guides/llm/glm-4.5)<br /><br />[API Reference](/api-reference/llm/chat-completion)             |
| GLM-4.5-Air         | Cost-Effective<br />Lightweight<br />High Performance                                                                           | English & Chinese | 128K    | [Guide](/guides/llm/glm-4.5)<br /><br />[API Reference](/api-reference/llm/chat-completion)             |
| GLM-4.5-AirX        | Lightweight<br />High Performance<br />Ultra-Fast Response                                                                      | English & Chinese | 128K    | [Guide](/guides/llm/glm-4.5)<br /><br />[API Reference](/api-reference/llm/chat-completion)             |
| GLM-4-32B-0414-128K | High intelligence at <br />unmatched cost-efficiency                                                                            | English & Chinese | 128K    | [Guide](/guides/llm/glm-4-32b-0414-128k)<br /><br />[API Reference](/api-reference/llm/chat-completion) |
| GLM-4.7-Flash       | Free, Lightweight<br />High Performance                                                                                         | English & Chinese | 200K    | [Guide](/guides/llm/glm-4.7)<br /><br />[API Reference](/api-reference/llm/chat-completion)             |
| GLM-4.5-Flash       | Free, Lightweight<br />Strong Reasoning<br />                                                                                   | English & Chinese | 200K    | [Guide](/guides/llm/glm-4.5)<br /><br />[API Reference](/api-reference/llm/chat-completion)             |

### Vision Models

Visual models process images or videos for recognition and analysis.

| Model           | Strength                                                                                                      | Language          | Context | Resource                                                                                         |
| :-------------- | :------------------------------------------------------------------------------------------------------------ | :---------------- | :------ | :----------------------------------------------------------------------------------------------- |
| GLM-5V-Turbo    | Multimodal Coding Capabilities<br />Context Size Increased to 200K<br />Deep Integration with Agent Workflows | English & Chinese | 200K    | [Guide](/guides/vlm/glm-5v-turbo)<br /><br />[API Reference](/api-reference/llm/chat-completion) |
| GLM-4.6V        | Native Function Call Support<br />Thinking Mode Switch Support                                                | English & Chinese | 128K    | [Guide](/guides/vlm/glm-4.6v)<br /><br />[API Reference](/api-reference/llm/chat-completion)     |
| GLM-OCR         | Document Parsing<br />Information Extraction                                                                  | Multiple          | /       | [Guide](/guides/vlm/glm-ocr)<br /><br />[API Reference](/api-reference/tools/layout-parsing)     |
| GLM-4.6V-FlashX | Native Function Call Support<br />Thinking Mode Switch Support<br />Lightweight & High-Speed                  | English & Chinese | 128K    | [Guide](/guides/vlm/glm-4.6v)<br /><br />[API Reference](/api-reference/llm/chat-completion)     |
| GLM-4.5V        | Multimodal<br />Flexible Reasoning                                                                            | English & Chinese | 64K     | [Guide](/guides/vlm/glm-4.5v)<br /><br />[API Reference](/api-reference/llm/chat-completion)     |
| GLM-4.6V-Flash  | Free, Native Function Call Support                                                                            | English & Chinese | 128K    | [Guide](/guides/vlm/glm-4.6v)<br /><br />[API Reference](/api-reference/llm/chat-completion)     |

### Built-in Tools

A suite of built-in tools designed to streamline workflows and boost productivity.

| Tool       | Capability                                                                                                                    |
| :--------- | :---------------------------------------------------------------------------------------------------------------------------- |
| Web Search | - Provide real-time, concise, direct answers<br />- Accurately parse complex HTML and converts it into clean Markdown or JSON |

### Image Generation Models

Image Generation Models learn from massive image data to automatically generate high-quality images from text.

| Model     | Strength                                                                                                      | Language          | Resolution           | Resource                                                                                         |
| :-------- | :------------------------------------------------------------------------------------------------------------ | :---------------- | :------------------- | :----------------------------------------------------------------------------------------------- |
| GLM-Image | - Stronger in complex instruction and knowledge-intensive scenarios<br />- Open-source SOTA in text rendering | English & Chinese | multiple resolutions | [Guide](/guides/image/glm-image)<br /><br />[API Reference](/api-reference/image/generate-image) |
| CogView-4 | - High-quality image generation<br />- Diverse styles<br />- Rich in detail                                   | English & Chinese | multiple resolutions | [Guide](/guides/image/cogview-4)<br /><br />[API Reference](/api-reference/image/generate-image) |

### Video Generation Models

Video Generation Models turn text, images, or clips into dynamic video content, accelerating creativity for film, virtual avatars, animation, and marketing.

| Model       | Strength                                                                              | Language          | Resolution           | Resource                                                                                              |
| :---------- | :------------------------------------------------------------------------------------ | :---------------- | :------------------- | :---------------------------------------------------------------------------------------------------- |
| CogVideoX-3 | Significant improvements in image quality, stability, and physical realism simulation | English & Chinese | multiple resolutions | [Guide](/guides/video/cogvideox-3)<br /><br />[API Reference](/api-reference/video/cogvideox-3\&vidu) |
| ViduQ1      | Theatrical quality with seamless temporal flow                                        | English & Chinese | 1080P                | [Guide](/guides/video/vidu-q1)<br /><br />[API Reference](/api-reference/video/cogvideox-3\&vidu)     |
| Vidu2       | Fast delivery with smart style preservation                                           | English & Chinese | 720P                 | [Guide](/guides/video/vidu2)<br /><br />[API Reference](/api-reference/video/cogvideox-3\&vidu)       |

### Audio Models

Audio models are a class of multimodal models that process audio and video signals, enabling the understanding, generation, or editing of audiovisual content.

| Model        | Strength                                                                                                                  | Multimodal Support | Resource                                                                                                  |
| :----------- | :------------------------------------------------------------------------------------------------------------------------ | :----------------- | :-------------------------------------------------------------------------------------------------------- |
| GLM-ASR-2512 | - CER as low as 0.0717<br />- Support user-defined vocabularies<br />- Support multiple mainstream languages and dialects | Audio              | [Guide](/guides/audio/glm-asr-2512)<br /><br />[API Reference](/api-reference/audio/audio-transcriptions) |

### Agents

A set of ready-made agents empower users to create and communicate effortlessly.

| Tool                                    | Capability                                                                 | Resource                      |
| :-------------------------------------- | :------------------------------------------------------------------------- | :---------------------------- |
| GLM Slide/Poster Agent(beta)            | Combine content generation with professional design                        | [Guide](/guides/agents/slide) |
| General-Purpose Translation             | Support 40+ languages, flexible strategies, and terminology customization  | [Guide](/guides/agents/slide) |
| Popular Special Effects Video Templates | Special effects video templates like French\_Kiss, BodyShake, and Sexy\_Me | [Guide](/guides/agents/slide) |

<!-- Source: https://docs.z.ai/guides/overview/pricing.md -->

> ## Documentation Index
> Fetch the complete documentation index at: https://docs.z.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Pricing

> This page provides pricing information for Z.AI’s models and tools. All prices are in USD.

## Models

### Text Models

Prices per 1M tokens.

| Model               | Input  | Cached Input | Cached Input Storage | Output |
| :------------------ | :----- | :----------- | :------------------- | :----- |
| GLM-5.1             | \$1.4  | \$0.26       | Limited-time Free    | \$4.4  |
| GLM-5               | \$1    | \$0.2        | Limited-time Free    | \$3.2  |
| GLM-5-Turbo         | \$1.2  | \$0.24       | Limited-time Free    | \$4.0  |
| GLM-4.7             | \$0.6  | \$0.11       | Limited-time Free    | \$2.2  |
| GLM-4.7-FlashX      | \$0.07 | \$0.01       | Limited-time Free    | \$0.4  |
| GLM-4.6             | \$0.6  | \$0.11       | Limited-time Free    | \$2.2  |
| GLM-4.5             | \$0.6  | \$0.11       | Limited-time Free    | \$2.2  |
| GLM-4.5-X           | \$2.2  | \$0.45       | Limited-time Free    | \$8.9  |
| GLM-4.5-Air         | \$0.2  | \$0.03       | Limited-time Free    | \$1.1  |
| GLM-4.5-AirX        | \$1.1  | \$0.22       | Limited-time Free    | \$4.5  |
| GLM-4-32B-0414-128K | \$0.1  | -            | -                    | \$0.1  |
| GLM-4.7-Flash       | Free   | Free         | Free                 | Free   |
| GLM-4.5-Flash       | Free   | Free         | Free                 | Free   |

### Vision Models

Prices per 1M tokens.

| Model           | Input  | Cached Input | Cached Input Storage | Output |
| :-------------- | :----- | :----------- | :------------------- | :----- |
| GLM-5V-Turbo    | \$1.2  | \$0.24       | Limited-time Free    | \$4    |
| GLM-4.6V        | \$0.3  | \$0.05       | Limited-time Free    | \$0.9  |
| GLM-OCR         | \$0.03 | \\           | \\                   | \$0.03 |
| GLM-4.6V-FlashX | \$0.04 | \$0.004      | Limited-time Free    | \$0.4  |
| GLM-4.5V        | \$0.6  | \$0.11       | Limited-time Free    | \$1.8  |
| GLM-4.6V-Flash  | Free   | Free         | Free                 | Free   |

### Built-in Tools

| Tool       | Cost         |
| :--------- | :----------- |
| Web Search | \$0.01 / use |

### Image Generation Models

Prices per image.

| Model     | Price   |
| :-------- | :------ |
| GLM-Image | \$0.015 |
| CogView-4 | \$0.01  |

### Video Generation Models

Prices per video.

| Model            | Price |
| :--------------- | :---- |
| CogVideoX-3      | \$0.2 |
| ViduQ1-Text      | \$0.4 |
| ViduQ1-Image     | \$0.4 |
| ViduQ1-Start-End | \$0.4 |
| Vidu2-Image      | \$0.2 |
| Vidu2-Start-End  | \$0.2 |
| Vidu2-Reference  | \$0.4 |

### Audio Models

| Model        | Price                                                       |
| :----------- | :---------------------------------------------------------- |
| GLM-ASR-2512 | \$0.03 / MTok (equivalent to approximately \$0.0024/minute) |

### Agents

| Agent                                   | Price         |
| :-------------------------------------- | :------------ |
| GLM Slide/Poster Agent(beta)            | \$0.7 / MTok  |
| General-Purpose Translation             | \$3 / MTok    |
| Popular Special Effects Video Templates | \$0.2 / video |

<!-- Source: https://docs.z.ai/guides/overview/concept-param.md -->

> ## Documentation Index
> Fetch the complete documentation index at: https://docs.z.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Core Parameters

<Tip>
  When interacting with models, you can control the model's output by adjusting different parameters to meet the needs of various scenarios. Understanding these core parameters will help you better utilize the model's capabilities.
</Tip>

## Quick Reference

| Parameter                   | Type    | Default Value         | Description                                                                                   |
| :-------------------------- | :------ | :-------------------- | :-------------------------------------------------------------------------------------------- |
| [do\_sample](#do_sample)    | Boolean | `true`                | Whether to sample the output to increase diversity.                                           |
| [temperature](#temperature) | Float   | (Model dependent)     | Controls the randomness of output, higher values are more random.                             |
| [top\_p](#top_p)            | Float   | (Model dependent)     | Controls diversity through nucleus sampling, recommended to use either this or `temperature`. |
| [max\_tokens](#max_tokens)  | Integer | (Model dependent)     | Limits the maximum number of tokens generated in a single call.                               |
| [stream](#stream)           | Boolean | `false`               | Whether to return responses in streaming mode.                                                |
| [thinking](#thinking)       | Object  | `{"type": "enabled"}` | Whether to enable chain-of-thought deep thinking, only supported by `GLM-4.5` and above.      |

***

## Parameter Details

### do\_sample

`do_sample` is a boolean value (`true` or `false`) that determines whether to sample the model's output.

* `true` (default): Performs random sampling based on the probability distribution of each token, increasing text diversity and creativity. Suitable for content creation, dialogue, and other scenarios.
* `false`: Uses a greedy strategy, always selecting the token with the highest probability. Provides high deterministic output, suitable for scenarios requiring precise, factual answers.

Best Practices:

* Set to `false` when you need reproducible, deterministic output.
* Set to `true` when you want the model to generate more diverse and interesting content, and use it in combination with `temperature` or `top_p`.

### temperature

The `temperature` parameter controls the randomness of the model's output.

* Lower values (e.g., 0.2): Make the probability distribution more "sharp", resulting in more deterministic and conservative output.
* Higher values (e.g., 0.8): Make the probability distribution more "flat", resulting in more random and diverse output.

Best Practices:

* For scenarios requiring rigor and factual accuracy (such as knowledge Q\&A), it's recommended to use lower `temperature`.
* For scenarios requiring creativity (such as content creation), you can try higher `temperature`.
* It's recommended to use only one of `temperature` and `top_p`.

### top\_p

`top_p` (nucleus sampling) controls diversity by sampling from the smallest set of tokens whose cumulative probability exceeds the threshold.

* Lower values (e.g., 0.2): Limit the sampling range, resulting in more deterministic output.
* Higher values (e.g., 0.9): Expand the sampling range, resulting in more diverse output.

Best Practices:

* If you want to achieve some diversity while ensuring content quality, `top_p` is a good choice (recommended values 0.8-0.95).
* It's generally not recommended to modify both `temperature` and `top_p` simultaneously.

### max\_tokens

`max_tokens` is used to limit the maximum number of tokens the model can generate in a single call. GLM-4.6 supports a maximum output length of 128K, GLM-4.5 supports a maximum output length of 96K, and it's recommended to set it to no less than 1024. Tokens are the basic units of text, typically 1 token equals approximately 0.75 English words or 1.5 Chinese characters. Setting an appropriate max\_tokens can control response length and cost, avoiding overly long outputs. If the model completes its answer before reaching the max\_tokens limit, it will naturally end; if it reaches the limit, the output may be truncated.

* Purpose: Prevents generating overly long text and controls API call costs.
* Note: `max_tokens` limits the length of generated content, not including input.

Best Practices:

* Set `max_tokens` reasonably according to your application scenario. If you need short answers, you can set it to a smaller value (e.g., 50).

Default `max_tokens` and maximum supported `max_tokens` for each model:

| Model Code          | Default max\_tokens | Maximum max\_tokens |
| :------------------ | :-----------------: | :-----------------: |
| glm-5.1             |        65536        |        131072       |
| glm-5v-turbo        |        65536        |        131072       |
| glm-5-turbo         |        65536        |        131072       |
| glm-5               |        65536        |        131072       |
| glm-4.7             |        65536        |        131072       |
| glm-4.6             |        65536        |        131072       |
| glm-4.6v            |        16384        |        32768        |
| glm-4.6v-flash      |        16384        |        32768        |
| glm-4.6v-flashx     |        16384        |        32768        |
| glm-4.5             |        65536        |        98304        |
| glm-4.5-air         |        65536        |        98304        |
| glm-4.5-x           |        65536        |        98304        |
| glm-4.5-airx        |        65536        |        98304        |
| glm-4.5-flash       |        65536        |        98304        |
| glm-4.5v            |        16384        |        16384        |
| glm-4-32b-0414-128k |        16384        |        16384        |

### stream

`stream` is a boolean value used to control the API's response method.

* `false` (default): Returns the complete response at once, simple to implement but with long waiting times.
* `true`: Returns content in streaming (SSE) mode, significantly improving the experience of real-time interactive applications.

Best Practices:

* For chatbots, real-time code generation, and other applications, it's strongly recommended to set this to `true`.

### thinking

The `thinking` parameter controls whether the model enables "Chain of Thought" for deeper thinking and reasoning.

* Type: Object
* Supported Models: `GLM-4.5` and above

Properties:

* `type` (string):
  * `enabled` (default): Enable chain of thought. `GLM-4.6` and `GLM-4.5` will automatically determine if needed, while `GLM-4.5V` will force thinking.
  * `disabled`: Disable chain of thought.

Best Practices:

* It's recommended to enable this when you need the model to perform complex reasoning and planning.
* For simple tasks, you can disable it to get faster responses.

***

## Related Concepts

<AccordionGroup>
  <Accordion title="Token Usage Calculation">
    Tokens are the basic units for model text processing. Usage calculation includes both input and output parts.

    * **Input Token Count:** The number of tokens contained in the text you send to the model.
    * **Output Token Count:** The number of tokens contained in the text generated by the model.
    * **Total Token Count:** The sum of input and output, usually used as the billing basis.

    You can call the `tokenizer` API to estimate the token count of text.
  </Accordion>

  <Accordion title="Maximum Output Tokens">
    Maximum Output Tokens refers to the maximum number of tokens a model can generate in a single request. It's different from the `max_tokens` parameter - `max_tokens` is the upper limit you set in your request, while Maximum Output Tokens is the architectural limitation of the model itself.

    For example, a model's context window might be 8k tokens, but its maximum output capability might be limited to 4k tokens.
  </Accordion>

  <Accordion title="Context Window">
    The Context Window refers to the total number of tokens a model can process in a single interaction, including all tokens from both **input text** and **generated text**.

    * **Importance:** The context window determines how much historical information the model can "remember". If the total length of input and expected output exceeds the model's context window, the model will be unable to process it.
    * **Note:** Different models have different context window sizes. When conducting long conversations or processing long documents, special attention should be paid to context window limitations.
  </Accordion>

  <Accordion title="Concurrency Limits">
    Concurrency refers to the number of API requests you can initiate simultaneously. This is set by the platform to ensure service stability and fair resource allocation.

    * **Limits:** Different users or subscription plans may have different concurrency quotas.
    * **Overages:** If you exceed the concurrency limit, new requests may fail or need to wait in queue.

    If your application requires high concurrency processing, please check your account limits or contact platform support.
  </Accordion>
</AccordionGroup>

<!-- Source: https://docs.z.ai/api-reference/introduction.md -->

> ## Documentation Index
> Fetch the complete documentation index at: https://docs.z.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Introduction

<Info>
  The API reference describes the RESTful APIs you can use to interact with the Z.AI platform.
</Info>

Z.AI provides standard HTTP API interfaces that support multiple programming languages and development environments, with [SDKs](/guides/develop/python/introduction) also available.

## API Endpoint

Z.ai Platform's general API endpoint is as follows:

```
https://api.z.ai/api/paas/v4
```

<Warning>
  Note: When using the [GLM Coding Plan](/devpack/overview), you need to configure the dedicated \
  Coding endpoint - [https://api.z.ai/api/coding/paas/v4](https://api.z.ai/api/coding/paas/v4) \
  instead of the general endpoint - [https://api.z.ai/api/paas/v4](https://api.z.ai/api/paas/v4) \
  Note: The Coding API endpoint is only for Coding scenarios and is not applicable to general API scenarios. Please use them accordingly.
</Warning>

## Authentication

The Z.AI API uses the standard **HTTP Bearer** for authentication.
An API key is required, which you can create or manage on the [API Keys Page](https://z.ai/manage-apikey/apikey-list).

API keys should be provided via HTTP Bearer Authentication in HTTP Request Headers.

```
Authorization: Bearer ZAI_API_KEY
```

## Playground

The API Playground allows developers to quickly try out API calls. Simply click **Try it** on the API details page to get started.

* On the API details page, there are many interactive options, such as **switching input types**, **switching tabs**, and **adding new content**.
* You can click **Add an item** or **Add new property** to add more properties the API need.
* **Note** that when switching the tabs, the previous properties value you need re-input or re-switch.

## Call Examples

<Tabs>
  <Tab title="cURL">
    ```bash theme={null}
    curl -X POST "https://api.z.ai/api/paas/v4/chat/completions" \
    -H "Content-Type: application/json" \
    -H "Accept-Language: en-US,en" \
    -H "Authorization: Bearer YOUR_API_KEY" \
    -d '{
        "model": "glm-5.1",
        "messages": [
            {
                "role": "system",
                "content": "You are a helpful AI assistant."
            },
            {
                "role": "user",
                "content": "Hello, please introduce yourself."
            }
        ],
        "temperature": 1.0,
        "stream": true
    }'
    ```
  </Tab>

  <Tab title="Official Python SDK">
    **Install SDK**

    ```bash theme={null}
    # Install latest version
    pip install zai-sdk

    # Or specify version
    pip install zai-sdk==0.2.2
    ```

    **Verify Installation**

    ```python theme={null}
    import zai
    print(zai.__version__)
    ```

    **Usage Example**

    ```python theme={null}
    from zai import ZaiClient

    # Initialize client
    client = ZaiClient(api_key="YOUR_API_KEY")

    # Create chat completion request
    response = client.chat.completions.create(
        model="glm-5.1",
        messages=[
            {
                "role": "system",
                "content": "You are a helpful AI assistant."
            },
            {
                "role": "user",
                "content": "Hello, please introduce yourself."
            }
        ]
    )

    # Get response
    print(response.choices[0].message.content)
    ```
  </Tab>

  <Tab title="Official Java SDK">
    **Install SDK**

    **Maven**

    ```xml theme={null}
    <dependency>
        <groupId>ai.z.openapi</groupId>
        <artifactId>zai-sdk</artifactId>
        <version>0.3.3</version>
    </dependency>
    ```

    **Gradle (Groovy)**

    ```groovy theme={null}
    implementation 'ai.z.openapi:zai-sdk:0.3.3'
    ```

    **Usage Example**

    ```java theme={null}
    import ai.z.openapi.ZaiClient;
    import ai.z.openapi.service.model.*;
    import java.util.Arrays;

    public class QuickStart {
        public static void main(String[] args) {
            // Initialize client
            ZaiClient client = ZaiClient.builder().ofZAI()
                .apiKey("YOUR_API_KEY")
                .build();

            // Create chat completion request
            ChatCompletionCreateParams request = ChatCompletionCreateParams.builder()
                .model("glm-5.1")
                .messages(Arrays.asList(
                    ChatMessage.builder()
                        .role(ChatMessageRole.USER.value())
                        .content("Hello, who are you?")
                        .build()
                ))
                .stream(false)
                .build();

            // Send request
            ChatCompletionResponse response = client.chat().createChatCompletion(request);

            // Get response
            System.out.println(response.getData().getChoices().get(0).getMessage().getContent());
        }
    }
    ```
  </Tab>

  <Tab title="OpenAI Python SDK">
    **Install SDK**

    ```bash theme={null}
    # Install or upgrade to latest version
    pip install --upgrade 'openai>=1.0'
    ```

    **Verify Installation**

    ```python theme={null}
    python -c "import openai; print(openai.__version__)"
    ```

    **Usage Example**

    ```python theme={null}
    from openai import OpenAI

    client = OpenAI(
        api_key="your-Z.AI-api-key",
        base_url="https://api.z.ai/api/paas/v4/"
    )

    completion = client.chat.completions.create(
        model="glm-5.1",
        messages=[
            {"role": "system", "content": "You are a smart and creative novelist"},
            {"role": "user", "content": "Please write a short fairy tale story as a fairy tale master"}
        ]
    )

    print(completion.choices[0].message.content)
    ```
  </Tab>

  <Tab title="OpenAI NodeJs SDK">
    **Install SDK**

    ```bash theme={null}
    # Install or upgrade to latest version
    npm install openai

    # Or using yarn
    yarn add openai
    ```

    **Usage Example**

    ```javascript theme={null}
    import OpenAI from "openai";

    const client = new OpenAI({
        apiKey: "your-Z.AI-api-key",
        baseURL: "https://api.z.ai/api/paas/v4/"
    });

    async function main() {
        const completion = await client.chat.completions.create({
            model: "glm-5.1",
            messages: [
                { role: "system", content: "You are a helpful AI assistant." },
                { role: "user", content: "Hello, please introduce yourself." }
            ]
        });

        console.log(completion.choices[0].message.content);
    }

    main();
    ```
  </Tab>

  <Tab title="OpenAI Java SDK">
    **Install SDK**

    **Maven**

    ```xml theme={null}
    <dependency>
        <groupId>com.openai</groupId>
        <artifactId>openai-java</artifactId>
        <version>2.20.1</version>
    </dependency>
    ```

    **Gradle (Groovy)**

    ```groovy theme={null}
    implementation 'com.openai:openai-java:2.20.1'
    ```

    **Usage Example**

    ```java theme={null}
    import com.openai.client.OpenAIClient;
    import com.openai.client.okhttp.OpenAIOkHttpClient;
    import com.openai.models.chat.completions.ChatCompletion;
    import com.openai.models.chat.completions.ChatCompletionCreateParams;

    public class QuickStart {
        public static void main(String[] args) {
            // Initialize client
            OpenAIClient client = OpenAIOkHttpClient.builder()
                .apiKey("your-Z.AI-api-key")
                .baseUrl("https://api.z.ai/api/paas/v4/")
                .build();

            // Create chat completion request
            ChatCompletionCreateParams params = ChatCompletionCreateParams.builder()
                .addSystemMessage("You are a helpful AI assistant.")
                .addUserMessage("Hello, please introduce yourself.")
                .model("glm-5.1")
                .build();

            // Send request and get response
            ChatCompletion chatCompletion = client.chat().completions().create(params);
            Object response = chatCompletion.choices().get(0).message().content();

            System.out.println(response);
        }
    }
    ```
  </Tab>
</Tabs>

<!-- Source: https://docs.z.ai/api-reference/api-code.md -->

> ## Documentation Index
> Fetch the complete documentation index at: https://docs.z.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Errors

When calling the API, the response code consists of two parts: the outer layer is the HTTP status code, and the inner layer is the business error code defined by Z.AI in the response body, which provides a more detailed error description.

## HTTP Status Code

| Code | Reason                                                                                          | Solution                                                                                            |
| :--- | :---------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------- |
| 200  | Business processing successful                                                                  | -                                                                                                   |
| 400  | Parameter error                                                                                 | Check if the interface parameters are correct                                                       |
| 400  | File content anomaly                                                                            | Check if the jsonl file content meets the requirements                                              |
| 401  | Authentication failure or Token timeout                                                         | Confirm if the API KEY and authentication token are correctly generated                             |
| 404  | Fine-tuning feature not available                                                               | Contact customer service to activate this feature                                                   |
| 404  | Fine-tuning task does not exist                                                                 | Ensure the fine-tuning task ID is correct                                                           |
| 429  | Interface request concurrency exceeded                                                          | Adjust the request frequency or contact business to increase concurrency                            |
| 429  | File upload frequency too fast                                                                  | Wait briefly and then request again                                                                 |
| 429  | Account balance exhausted                                                                       | Recharge the account to ensure sufficient balance                                                   |
| 429  | Account anomaly                                                                                 | Account has violation, please contact platform customer service to unlock                           |
| 429  | Terminal account anomaly                                                                        | Terminal user has violation, account has been locked                                                |
| 434  | No API permission, fine-tuning API and file management API are in beta phase, we will open soon | Wait for the interface to be officially open or contact platform customer service to apply for beta |
| 435  | File size exceeds 100MB                                                                         | Use a jsonl file smaller than 100MB or upload in batches                                            |
| 500  | Server error occurred while processing the request                                              | Try again later or contact customer service                                                         |

## Business Error Codes

| Error Category         | Code | Error Message                                                                                                                                                                                                                  |
| :--------------------- | :--- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Basic Error            | 500  | Internal Error                                                                                                                                                                                                                 |
| Authentication Error   | 1000 | Authentication Failed                                                                                                                                                                                                          |
|                        | 1001 | Authentication parameter not received in Header, unable to authenticate                                                                                                                                                        |
|                        | 1002 | Invalid Authentication Token, please confirm the correct transmission of the Authentication Token                                                                                                                              |
|                        | 1003 | Authentication Token expired, please regenerate/obtain                                                                                                                                                                         |
|                        | 1004 | Authentication failed with the provided Authentication Token                                                                                                                                                                   |
|                        | 1100 | Account Read/Write                                                                                                                                                                                                             |
| Account Error          | 1110 | Your account is currently inactive. Please check your account information                                                                                                                                                      |
|                        | 1111 | Your account does not exist                                                                                                                                                                                                    |
|                        | 1112 | Your account has been locked, please contact customer service to unlock                                                                                                                                                        |
|                        | 1113 | Your account is in arrears, please recharge and try again                                                                                                                                                                      |
|                        | 1120 | Unable to successfully access your account, please try again later                                                                                                                                                             |
|                        | 1121 | Account has irregular activities and has been locked                                                                                                                                                                           |
| API Call Error         | 1200 | API Call Error                                                                                                                                                                                                                 |
|                        | 1210 | Incorrect API call parameters, please check the documentation                                                                                                                                                                  |
|                        | 1211 | Model does not exist, please check the model code                                                                                                                                                                              |
|                        | 1212 | Current model does not support `${method}` call method                                                                                                                                                                         |
|                        | 1213 | `${field}` parameter not received properly                                                                                                                                                                                     |
|                        | 1214 | Invalid `${field}` parameter. Please check the documentation                                                                                                                                                                   |
|                        | 1215 | `${field1}` and `${field2}` cannot be set simultaneously, please check the documentation                                                                                                                                       |
|                        | 1220 | You do not have permission to access `${API_name}`                                                                                                                                                                             |
|                        | 1221 | API `${API_name}` has been taken offline                                                                                                                                                                                       |
|                        | 1222 | API `${API_name}` does not exist                                                                                                                                                                                               |
|                        | 1230 | API call process error                                                                                                                                                                                                         |
|                        | 1231 | You already have a request: `${request_id}`                                                                                                                                                                                    |
|                        | 1234 | Network error, error id: `${error_id}`, please contact customer service                                                                                                                                                        |
|                        | 1261 | Prompt exceeds max length                                                                                                                                                                                                      |
| API Policy Block Error | 1300 | API call blocked by policy                                                                                                                                                                                                     |
|                        | 1301 | System detected potentially unsafe or sensitive content in input or generation. Please avoid using prompts that may generate sensitive content. Thank you for your cooperation.                                                |
|                        | 1302 | High concurrency usage of this API, please reduce concurrency or contact customer service to increase limits                                                                                                                   |
|                        | 1303 | High frequency usage of this API, please reduce frequency or contact customer service to increase limits                                                                                                                       |
|                        | 1304 | Daily call limit for this API reached. For more requests, please contact customer service to purchase                                                                                                                          |
|                        | 1305 | The API has triggered a rate limit.                                                                                                                                                                                            |
|                        | 1308 | Usage limit reached for {number} {unit}. Your limit will reset at `${next_flush_time}`                                                                                                                                         |
|                        | 1309 | Your GLM Coding Plan package has expired and is temporarily unavailable. You can resume using it after renewing the subscription on the official website. [https://z.ai/subscribe](https://z.ai/subscribe)                     |
|                        | 1310 | Weekly/Monthly Limit Exhausted. Your limit will reset at `${next_flush_time}`                                                                                                                                                  |
|                        | 1311 | Your current subscription plan does not yet include access to `${model_name}`                                                                                                                                                  |
|                        | 1312 | This model is currently experiencing high traffic. Please try again later, or switch to another model such as `${model_name}`                                                                                                  |
|                        | 1313 | Your usage violates the Fair Use Policy. Your request rate has been restricted. See Subscription Service Agreement for details. To restore access, go to Personal Center → My Subscription and request to lift the restriction |

## Error Shapes

Errors are always returned as JSON, with a top-level error object that includes a `code` and `message` value.

```json theme={null}
{
  "error": {
    "code": "1214",
    "message": "Input cannot be empty"
  }
}
```

## Error Example

The following is the response message of a curl request, where 401 is the HTTP status code and 1002 is the business error code.

```
* We are completely uploaded and fine
< HTTP/2 401
< date: Wed, 20 Mar 2024 03:06:05 GMT
< content-type: application/json
< set-cookie: acw_tc=76b20****a0e42;path=/;HttpOnly;Max-Age=1800
< server: nginx/1.21.6
< vary: Origin
< vary: Access-Control-Request-Method
< vary: Access-Control-Request-Headers
<
* Connection #0 to host open.z.ai left intact
{"error":{"code":"1002","message":"Authorization Token is invalid, please ensure that the Authorization Token is correctly provided."}}
```

> **Note**: When using streaming (SSE) calls, if the API terminates abnormally during inference, the above error codes will not be returned. Instead, the reason for the exception will be provided in the `finish_reason` parameter of the response body. For details, please refer to the description of the `finish_reason` parameter.

<!-- Source: https://docs.z.ai/guides/vlm/glm-ocr.md -->

> ## Documentation Index
> Fetch the complete documentation index at: https://docs.z.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# GLM-OCR

## <Icon icon="rectangle-list" iconType="solid" color="#ffffff" size={36} />   Overview

GLM-OCR is a lightweight professional OCR model with parameters as small as 0.9B, yet it achieves state-of-the-art performance across multiple capabilities. It sets a new benchmark for document parsing with its “small size and high accuracy.” Key features include:

* **Performance SOTA**: Scored 94.62 points to top OmniDocBench V1.5 and achieved current best performance across **multiple mainstream document understanding benchmarks** including tables and formulas at launch.
* **Optimized for Real-World Scenarios**: Delivers stable, leading accuracy in complex environments like code documentation, intricate tables, and stamp recognition. Maintains exceptional recognition precision even with complex layouts, diverse fonts, or mixed text-image content.
* **Efficient and Cost-Effective**: With just 0.9B parameters, supports VLLM and SGLang deployment, significantly reducing inference latency and computational overhead.

<CardGroup cols={3}>
  <Card title="Input Modality" icon="arrow-down-right" color="#ffffff">
    - PDF, images (JPG, PNG)
    - Single image ≤ 10MB, PDF ≤ 50MB
    - Maximum support: 100 pages
  </Card>

  <Card title="Output Modality" icon="arrow-down-left" color="#ffffff">
    Text / Image Links / MD Documents
  </Card>

  <Card title="Supported Language" icon="language" color="#ffffff">
    Support Chinese, English, French, Spanish, Russian, German, Japanese, Korean, etc.
  </Card>
</CardGroup>

<Tip>
  For detailed pricing information on GLM-OCR, please visit the [Pricing Page](/guides/overview/pricing).
</Tip>

## <Icon icon="list" iconType="solid" color="#ffffff" size={36} />   Usage

<AccordionGroup>
  <Accordion title="Text Recognition">
    Recognize text content from photos, screenshots, documents, and scans, supporting printed text, handwriting, and mathematical formulas. Applicable to diverse scenarios including education, research, and office work.
  </Accordion>

  <Accordion title="Table Recognition">
    Identify table structures and content, converting them into HTML-formatted sequences. Suitable for scenarios involving table data entry, conversion, and editing.
  </Accordion>

  <Accordion title="Information Structuring">
    Extract key information from various cards, certificates, receipts, and forms, outputting structured JSON data. Supports applications in banking, insurance, government services, legal, logistics, and other industries.
  </Accordion>

  <Accordion title="Retrieval-Augmented Generation (RAG)">
    Support high-volume document recognition and parsing with high accuracy and standardized output formats, providing a robust foundation for RAG.
  </Accordion>
</AccordionGroup>

## <Icon icon="bars-sort" iconType="solid" color="#ffffff" size={36} />   Resources

* [API Documentation](/api-reference/tools/layout-parsing): Learn how to call the API.

## <Icon icon="arrow-down-from-line" iconType="solid" color="#ffffff" size={36} />   Introducing GLM-OCR

<Steps>
  <Step title="State-of-the-Art Performance, Precision in Action" stepNumber={1} titleSize="h3">
    Thanks to its proprietary CogViT visual encoder and deep scene optimization, GLM-OCR achieves “compact size, high accuracy.”

    With only 0.9B parameters, GLM-OCR achieved SOTA on the authoritative document parsing benchmark OmniDocBench V1.5 with a score of 94.6. It outperforms multiple specialized OCR models across four key domains—text, formula, table recognition, and information extraction—with performance approaching that of Gemini-3-Pro.

    ![Description](https://cdn.bigmodel.cn/markdown/1770048309140img_v3_02uh_d2a8a208-0969-4c06-9a14-fa1d6aa705dg.png?attname=img_v3_02uh_d2a8a208-0969-4c06-9a14-fa1d6aa705dg.png)

    Beyond public benchmarks, we conducted internal evaluations across six core real-world scenarios. Results show GLM-OCR delivers significant advantages across dimensions including code documentation, real-world tables, handwriting, multilingual text, seal recognition, and invoice extraction.

    ![Description](https://cdn.bigmodel.cn/markdown/1770048316118img_v3_02uh_c048a7e7-327c-4591-a620-b04113f6acfg.png?attname=img_v3_02uh_c048a7e7-327c-4591-a620-b04113f6acfg.png)
  </Step>

  <Step title="Faster, More Cost-Effective" stepNumber={2} titleSize="h3">
    For speed, we compared different OCR methods under identical hardware and testing conditions (single replica, single concurrency), evaluating their performance in parsing and exporting Markdown files from both image and PDF inputs. Results show GLM-OCR achieves a throughput of 1.86 pages/second for PDF documents and 0.67 images/second for images, significantly outperforming comparable models.

    ![Description](https://cdn.bigmodel.cn/markdown/1770038419131img_v3_02uh_8dd8ba6c-3ba0-4a13-9894-53700c931ffg.png?attname=img_v3_02uh_8dd8ba6c-3ba0-4a13-9894-53700c931ffg.png)

    Pricing is uniform for both API input and output, costing just \$0.03 per million tokens.
  </Step>
</Steps>

## <Icon icon="objects-column" iconType="solid" color="#ffffff" size={36} />    Examples

<Tabs>
  <Tab title="Code Block Recognition">
    <CardGroup cols={2}>
      <Card title="Input" icon="arrow-down-right">
        ![Description](https://cdn.bigmodel.cn/markdown/1770035979049image.png?attname=image.png)
      </Card>

      <Card title="Output" icon="arrow-down-left">
        ![Description](https://cdn.bigmodel.cn/markdown/1770036049307image.png?attname=image.png)
      </Card>
    </CardGroup>
  </Tab>

  <Tab title="Complex Chart Content Recognition">
    <CardGroup cols={2}>
      <Card title="Input" icon="arrow-down-right">
        ![Description](https://cdn.bigmodel.cn/markdown/1770036076806image.png?attname=image.png)
      </Card>

      <Card title="Output" icon="arrow-down-left">
        ![Description](https://cdn.bigmodel.cn/markdown/1770036127560image.png?attname=image.png)
      </Card>
    </CardGroup>
  </Tab>

  <Tab title="Bill Recognition">
    <CardGroup cols={2}>
      <Card title="Input" icon="arrow-down-right">
        ![Description](https://cdn.bigmodel.cn/markdown/1770036142376image.png?attname=image.png)
      </Card>

      <Card title="Output" icon="arrow-down-left">
        ![Description](https://cdn.bigmodel.cn/markdown/1770036153340image.png?attname=image.png)
      </Card>
    </CardGroup>
  </Tab>

  <Tab title="Handwriting Recognition">
    <CardGroup cols={2}>
      <Card title="Input" icon="arrow-down-right">
        ![Description](https://cdn.bigmodel.cn/markdown/1770036167626image.png?attname=image.png)
      </Card>

      <Card title="Output" icon="arrow-down-left">
        ![Description](https://cdn.bigmodel.cn/markdown/1770036178291image.png?attname=image.png)
      </Card>
    </CardGroup>
  </Tab>
</Tabs>

## <Icon icon="rectangle-code" iconType="solid" color="#ffffff" size={36} />    Quick Start

<Tabs>
  <Tab title="cURL">
    ```bash theme={null}
    curl --location --request POST 'https://api.z.ai/api/paas/v4/layout_parsing' \
    --header 'Authorization: Bearer your-api-key' \
    --header 'Content-Type: application/json' \
    --data-raw '{
      "model": "glm-ocr",
      "file": "https://cdn.bigmodel.cn/static/logo/introduction.png"
    }'
    ```
  </Tab>

  <Tab title="Python">
    **Install SDK**

    ```bash theme={null}
    # Install the latest version
    pip install zai-sdk
    # Or specify a version
    pip install zai-sdk==0.2.2
    ```

    **Verify installation**

    ```python theme={null}
    import zai
    print(zai.__version__)
    ```

    **Basic Call**

    ```python theme={null}
    from zai import ZaiClient

    # Initialize client
    client = ZaiClient(api_key="your-api-key")

    image_url = "https://cdn.bigmodel.cn/static/logo/introduction.png"

    # Call layout parsing API
    response = client.layout_parsing.create(
        model="glm-ocr",
        file=image_url
    )

    # Output result
    print(response)
    ```
  </Tab>

  <Tab title="Java">
    **Install SDK**

    **Maven**

    ```xml theme={null}
    <dependency>
      <groupId>ai.z.openapi</groupId>
      <artifactId>zai-sdk</artifactId>
      <version>0.3.3</version>
    </dependency>
    ```

    **Gradle (Groovy)**

    ```groovy theme={null}
    implementation 'ai.z.openapi:zai-sdk:0.3.3'
    ```

    **Basic Call**

    ```java theme={null}
    import ai.z.openapi.ZaiClient;
    import ai.z.openapi.service.layoutparsing.LayoutParsingCreateParams;
    import ai.z.openapi.service.layoutparsing.LayoutParsingResponse;
    import ai.z.openapi.service.layoutparsing.LayoutParsingResult;

    public class LayoutParsing {
        public static void main(String[] args) {
            // Initialize client
            ZaiClient client = ZaiClient.builder()
                .ofZAI()
                .apiKey("your-api-key")
                .build();

            String model = "glm-ocr";
            String file = "https://cdn.bigmodel.cn/static/logo/introduction.png";

            // Create layout parsing request
            LayoutParsingCreateParams params = LayoutParsingCreateParams.builder()
                .model(model)
                .file(file)
                .build();

            // Send request
            LayoutParsingResponse response = client.layoutParsing().layoutParsing(params);

            // Handle response
            if (response.isSuccess()) {
                System.out.println("Parsing result: " + response.getData());
            } else {
                System.err.println("Error: " + response.getMsg());
            }
        }
    }
    ```
  </Tab>
</Tabs>

<!-- Source: https://docs.z.ai/api-reference/tools/layout-parsing.md -->

> ## Documentation Index
> Fetch the complete documentation index at: https://docs.z.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Layout Parsing

> Use the [GLM-OCR](/guides/vlm/glm-ocr) model to parse the layout of documents and images and extract text content. Support OCR recognition of images and PDF documents, returning detailed layout information and visualization results.



## OpenAPI

````yaml POST /paas/v4/layout_parsing
openapi: 3.0.1
info:
  title: Z.AI API
  description: Z.AI API available endpoints
  license:
    name: Z.AI Developer Agreement and Policy
    url: https://chat.z.ai/legal-agreement/terms-of-service
  version: 1.0.0
  contact:
    name: Z.AI Developers
    url: https://chat.z.ai/legal-agreement/privacy-policy
    email: user_feedback@z.ai
servers:
  - url: https://api.z.ai/api
    description: Production server
security:
  - bearerAuth: []
paths:
  /paas/v4/layout_parsing:
    post:
      summary: Layout Parsing
      description: >-
        Use the [GLM-OCR](/guides/vlm/glm-ocr) model to parse the layout of
        documents and images and extract text content. Support OCR recognition
        of images and PDF documents, returning detailed layout information and
        visualization results.
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/LayoutParsingRequest'
            examples:
              Layout Parsing Example:
                value:
                  model: glm-ocr
                  file: https://cdn.bigmodel.cn/static/logo/introduction.png
        required: true
      responses:
        '200':
          description: Business processing successful
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/LayoutParsingResponse'
        default:
          description: Request failed.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
components:
  schemas:
    LayoutParsingRequest:
      type: object
      required:
        - model
        - file
      properties:
        model:
          type: string
          description: 'Model code: `glm-ocr`'
          example: glm-ocr
          enum:
            - glm-ocr
        file:
          type: string
          description: >-
            Image or PDF document to be recognized, supports URL and base64.
            Supported image formats: PDF, JPG, PNG. Single image ≤10MB, PDF
            ≤50MB, maximum support 100 pages
          example: https://cdn.bigmodel.cn/static/logo/introduction.png
        return_crop_images:
          type: boolean
          description: Whether to return screenshot information
          default: false
        need_layout_visualization:
          type: boolean
          description: Whether to return detailed layout image result information
          default: false
        start_page_id:
          type: integer
          description: Start page number for parsing when PDF is provided
          minimum: 1
        end_page_id:
          type: integer
          description: End page number for parsing when PDF is provided
          minimum: 1
        request_id:
          type: string
          description: Unique request identifier, automatically generated if not provided
          example: req_123456789
        user_id:
          type: string
          description: 'End user ID for abuse monitoring. Length: 6-128 characters'
          minLength: 6
          maxLength: 128
          example: user_123456
    LayoutParsingResponse:
      type: object
      properties:
        id:
          type: string
          description: Task ID
          example: task_123456789
        created:
          type: integer
          format: int64
          description: Request creation time, Unix timestamp in seconds
          example: 1727156815
        model:
          type: string
          description: Model name
          example: GLM-OCR
        md_results:
          type: string
          description: Recognition result in Markdown format
          example: |-
            # Doc title
            This is the document content...
        layout_details:
          type: array
          description: Detailed layout information
          items:
            type: array
            items:
              $ref: '#/components/schemas/LayoutDetail'
        layout_visualization:
          type: array
          description: Recognition result image URLs
          items:
            type: string
        data_info:
          $ref: '#/components/schemas/DataInfo'
        usage:
          type: object
          description: Token usage statistics returned when the model call ends.
          properties:
            prompt_tokens:
              type: number
              description: Number of tokens in user input
            completion_tokens:
              type: number
              description: Number of output tokens
            prompt_tokens_details:
              type: object
              properties:
                cached_tokens:
                  type: number
                  description: Number of tokens served from cache
            total_tokens:
              type: integer
              description: Total number of tokens
        request_id:
          type: string
          description: Request ID
          example: req_123456789
      required:
        - id
        - created
        - model
    Error:
      required:
        - code
        - message
      type: object
      description: The request has failed.
      properties:
        code:
          type: integer
          format: int32
          description: Error code.
        message:
          type: string
          description: Error message.
    LayoutDetail:
      type: object
      description: Layout detail element
      properties:
        index:
          type: integer
          description: Element index
          example: 1
        label:
          type: string
          description: >-
            Element type: image for images, text for text content, formula for
            inline formulas, table for tables
          enum:
            - image
            - text
            - formula
            - table
          example: text
        bbox_2d:
          type: array
          description: Normalized element coordinates [x1,y1,x2,y2]
          items:
            type: number
            minimum: 0
            maximum: 1
          minItems: 4
          maxItems: 4
          example:
            - 0.1
            - 0.1
            - 0.5
            - 0.3
        content:
          type: string
          description: Element content (text / image URL / table HTML)
          example: This is the content of the element
        height:
          type: integer
          description: Page height
          example: 800
        width:
          type: integer
          description: Page width
          example: 600
      required:
        - index
        - label
    DataInfo:
      type: object
      description: Document basic information
      properties:
        num_pages:
          type: integer
          description: Total number of document pages
          example: 5
        pages:
          type: array
          description: Document page count information
          items:
            $ref: '#/components/schemas/PageInfo'
      required:
        - num_pages
    PageInfo:
      type: object
      description: Page dimension information
      properties:
        width:
          type: integer
          description: Page width
          example: 600
        height:
          type: integer
          description: Page height
          example: 800
      required:
        - width
        - height
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      description: >-
        Use the following format for authentication: Bearer [<your api
        key>](https://z.ai/manage-apikey/apikey-list)

````

<!-- Source: https://docs.z.ai/api-reference/tools/web-reader.md -->

> ## Documentation Index
> Fetch the complete documentation index at: https://docs.z.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Web Reader

> Reads and parses the content of the specified URL. Supports selectable return formats, cache control, image retention, and summary options.



## OpenAPI

````yaml POST /paas/v4/reader
openapi: 3.0.1
info:
  title: Z.AI API
  description: Z.AI API available endpoints
  license:
    name: Z.AI Developer Agreement and Policy
    url: https://chat.z.ai/legal-agreement/terms-of-service
  version: 1.0.0
  contact:
    name: Z.AI Developers
    url: https://chat.z.ai/legal-agreement/privacy-policy
    email: user_feedback@z.ai
servers:
  - url: https://api.z.ai/api
    description: Production server
security:
  - bearerAuth: []
paths:
  /paas/v4/reader:
    post:
      tags:
        - Tools API
      summary: Web Reader
      description: >-
        Reads and parses the content of the specified URL. Supports selectable
        return formats, cache control, image retention, and summary options.
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ReaderRequest'
            examples:
              Basic:
                value:
                  url: https://www.example.com
        required: true
      responses:
        '200':
          description: Processing successful
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ReaderResponse'
        default:
          description: The request has failed.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
components:
  schemas:
    ReaderRequest:
      type: object
      properties:
        url:
          type: string
          description: The URL to retrieve
        timeout:
          type: integer
          description: Request timeout in seconds. Default is 20
          default: 20
        no_cache:
          type: boolean
          description: Whether to disable caching (true/false). Default is false
          default: false
        return_format:
          type: string
          description: Return format (e.g., markdown, text). Default is markdown
          default: markdown
        retain_images:
          type: boolean
          description: Whether to retain images (true/false). Default is true
          default: true
        no_gfm:
          type: boolean
          description: >-
            Whether to disable GitHub Flavored Markdown (true/false). Default is
            false
          default: false
        keep_img_data_url:
          type: boolean
          description: Whether to keep image data URLs (true/false). Default is false
          default: false
        with_images_summary:
          type: boolean
          description: Whether to include image summary (true/false). Default is false
          default: false
        with_links_summary:
          type: boolean
          description: Whether to include links summary (true/false). Default is false
          default: false
      required:
        - url
    ReaderResponse:
      type: object
      properties:
        id:
          type: string
          description: Task ID
        created:
          type: integer
          format: int64
          description: Request creation time as a Unix timestamp in seconds
        request_id:
          type: string
          description: >-
            Client-provided unique identifier to distinguish requests. If not
            provided, the platform will generate one.
        model:
          type: string
          description: Model code
        reader_result:
          type: object
          description: Web reading result
          properties:
            content:
              type: string
              description: Main content parsed from the page (body, images, links, etc.)
            description:
              type: string
              description: Brief description of the page
            title:
              type: string
              description: Page title
            url:
              type: string
              description: Original page URL
            external:
              type: object
              description: External resources referenced by the page
              properties:
                stylesheet:
                  type: object
                  description: Collection of external stylesheets
                  additionalProperties:
                    type: object
                    properties:
                      type:
                        type: string
                        description: Stylesheet MIME type, typically `text/css`
            metadata:
              type: object
              description: Page metadata
              properties:
                keywords:
                  type: string
                  description: Page keywords
                viewport:
                  type: string
                  description: Viewport settings
                description:
                  type: string
                  description: Meta description
                format-detection:
                  type: string
                  description: Format detection settings, e.g., `telephone=no`
    Error:
      required:
        - code
        - message
      type: object
      description: The request has failed.
      properties:
        code:
          type: integer
          format: int32
          description: Error code.
        message:
          type: string
          description: Error message.
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      description: >-
        Use the following format for authentication: Bearer [<your api
        key>](https://z.ai/manage-apikey/apikey-list)

````
