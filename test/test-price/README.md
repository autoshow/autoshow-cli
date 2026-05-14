Price selectors for `bun t --test-price` live under this namespace.

These paths are selector names, not Bun test files. Use them to run price
preflights without selecting live e2e tests, for example:

```sh
bun t test/test-price/step-4-tts/services --test-price
```
