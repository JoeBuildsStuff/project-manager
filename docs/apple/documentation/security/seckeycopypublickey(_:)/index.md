# SecKeyCopyPublicKey(\_:)

Gets the public key associated with the given private key.

iOS 10.0+iPadOS 10.0+Mac Catalyst 13.1+macOS 10.12+tvOS 10.0+visionOS 1.0+watchOS 3.0+

```
func SecKeyCopyPublicKey(_ key: SecKey) -> SecKey?
```

## [Parameters](https://developer.apple.com/documentation/security/seckeycopypublickey(_:)\#parameters)

`key`

The private key for which you want the corresponding public key.

## [Return Value](https://developer.apple.com/documentation/security/seckeycopypublickey(_:)\#return-value)

The public key corresponding to the given private key. In Objective-C, call the [`CFRelease`](https://developer.apple.com/documentation/CoreFoundation/CFRelease) function to free this key’s memory when you are done with it.

## [Mentioned in](https://developer.apple.com/documentation/security/seckeycopypublickey(_:)\#mentions)

[Generating New Cryptographic Keys](https://developer.apple.com/documentation/security/generating-new-cryptographic-keys)

[Getting an Existing Key](https://developer.apple.com/documentation/security/getting-an-existing-key)

[Protecting keys with the Secure Enclave](https://developer.apple.com/documentation/security/protecting-keys-with-the-secure-enclave)

## [Discussion](https://developer.apple.com/documentation/security/seckeycopypublickey(_:)\#Discussion)

The returned public key may be `nil` if the app that created the private key didn’t also store the corresponding public key in the keychain, or if the system can’t reconstruct the corresponding public key.
