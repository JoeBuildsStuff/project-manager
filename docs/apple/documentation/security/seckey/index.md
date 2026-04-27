# SecKey

An object that represents a cryptographic key.

iOS 2.0+iPadOS 2.0+Mac Catalyst 13.0+macOS 10.0+tvOS 9.0+visionOS 1.0+watchOS 2.0+

```
class SecKey
```

## [Mentioned in](https://developer.apple.com/documentation/security/seckey\#mentions)

[Getting an Existing Key](https://developer.apple.com/documentation/security/getting-an-existing-key)

## [Overview](https://developer.apple.com/documentation/security/seckey\#overview)

A [`SecKey`](https://developer.apple.com/documentation/security/seckey) instance that represents a key that is stored in a keychain can be safely cast to a [`SecKeychainItem`](https://developer.apple.com/documentation/security/seckeychainitem) for manipulation as a keychain item. On the other hand, if the key is not stored in a keychain, casting the object to a [`SecKeychainItem`](https://developer.apple.com/documentation/security/seckeychainitem) and passing it to Keychain Services functions returns errors.

## [Relationships](https://developer.apple.com/documentation/security/seckey\#relationships)

### [Conforms To](https://developer.apple.com/documentation/security/seckey\#conforms-to)

- [`Equatable`](https://developer.apple.com/documentation/Swift/Equatable)
- [`Hashable`](https://developer.apple.com/documentation/Swift/Hashable)
