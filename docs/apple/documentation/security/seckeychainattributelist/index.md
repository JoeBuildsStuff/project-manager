# SecKeychainAttributeList

A list of keychain attributes.

macOS 10.0+

```
struct SecKeychainAttributeList
```

## [Topics](https://developer.apple.com/documentation/security/seckeychainattributelist\#topics)

### [Instance Properties](https://developer.apple.com/documentation/security/seckeychainattributelist\#Instance-Properties)

[`var attr: UnsafeMutablePointer<SecKeychainAttribute>?`](https://developer.apple.com/documentation/security/seckeychainattributelist/attr)

A pointer to the first keychain attribute in the array.

[`var count: UInt32`](https://developer.apple.com/documentation/security/seckeychainattributelist/count)

The number of keychain attributes in the array.

### [Initializers](https://developer.apple.com/documentation/security/seckeychainattributelist\#Initializers)

[`init()`](https://developer.apple.com/documentation/security/seckeychainattributelist/init())

[`init(count: UInt32, attr: UnsafeMutablePointer<SecKeychainAttribute>?)`](https://developer.apple.com/documentation/security/seckeychainattributelist/init(count:attr:))

## [Relationships](https://developer.apple.com/documentation/security/seckeychainattributelist\#relationships)

### [Conforms To](https://developer.apple.com/documentation/security/seckeychainattributelist\#conforms-to)

- [`BitwiseCopyable`](https://developer.apple.com/documentation/Swift/BitwiseCopyable)
