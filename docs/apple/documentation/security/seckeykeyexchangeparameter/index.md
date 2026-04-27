# SecKeyKeyExchangeParameter

The dictionary keys used to specify Diffie-Hellman key exchange parameters.

iOS 10.0+iPadOS 10.0+Mac Catalyst 13.1+macOS 10.12+tvOS 10.0+visionOS 1.0+watchOS 3.0+

```
struct SecKeyKeyExchangeParameter
```

## [Discussion](https://developer.apple.com/documentation/security/seckeykeyexchangeparameter\#Discussion)

Use these constants as keys in the dictionary that you input to the [`SecKeyCopyKeyExchangeResult(_:_:_:_:_:)`](https://developer.apple.com/documentation/security/seckeycopykeyexchangeresult(_:_:_:_:_:)) function as a means to refine the process of Diffie-Hellman key exchange.

## [Topics](https://developer.apple.com/documentation/security/seckeykeyexchangeparameter\#topics)

### [Type Properties](https://developer.apple.com/documentation/security/seckeykeyexchangeparameter\#Type-Properties)

[`static let requestedSize: SecKeyKeyExchangeParameter`](https://developer.apple.com/documentation/security/seckeykeyexchangeparameter/requestedsize)

[`static let sharedInfo: SecKeyKeyExchangeParameter`](https://developer.apple.com/documentation/security/seckeykeyexchangeparameter/sharedinfo)

### [Initializers](https://developer.apple.com/documentation/security/seckeykeyexchangeparameter\#Initializers)

[`init(rawValue: CFString)`](https://developer.apple.com/documentation/security/seckeykeyexchangeparameter/init(rawvalue:))

## [Relationships](https://developer.apple.com/documentation/security/seckeykeyexchangeparameter\#relationships)

### [Conforms To](https://developer.apple.com/documentation/security/seckeykeyexchangeparameter\#conforms-to)

- [`Equatable`](https://developer.apple.com/documentation/Swift/Equatable)
- [`Hashable`](https://developer.apple.com/documentation/Swift/Hashable)
- [`RawRepresentable`](https://developer.apple.com/documentation/Swift/RawRepresentable)
- [`Sendable`](https://developer.apple.com/documentation/Swift/Sendable)
- [`SendableMetatype`](https://developer.apple.com/documentation/Swift/SendableMetatype)
