# Keys

Generate, store, and use cryptographic keys.

## [Overview](https://developer.apple.com/documentation/security/keys\#overview)

Cryptographic keys are strings of bytes that you combine with other data in specialized mathematical operations to enhance security. At the lowest level, this usually means participating in either encryption and decryption or digital signing and verification. You can use these basic operations directly, such as when you encrypt data before sending it through an insecure channel. You also use them implicitly, such as when you verify the digital signature on a certificate as a byproduct of a trust evaluation.

Keys vary based on the operations they support. For example, you use public and private key pairs to perform asymmetric encryption, whereas you use symmetric keys to conduct symmetric encryption. Similarly, one key might work for a 1024-bit RSA algorithm, while another might be suitable for a 256-bit elliptic curve algorithm. Use the functions in this section when you need to handle cryptographic keys.

## [Topics](https://developer.apple.com/documentation/security/keys\#topics)

### [Essentials](https://developer.apple.com/documentation/security/keys\#Essentials)

[Getting an Existing Key](https://developer.apple.com/documentation/security/getting-an-existing-key)

Learn how to obtain an existing cryptographic key.

[Storing Keys in the Keychain](https://developer.apple.com/documentation/security/storing-keys-in-the-keychain)

Store and access cryptographic keys in the keychain.

[`class SecKey`](https://developer.apple.com/documentation/security/seckey)

An object that represents a cryptographic key.

[`func SecKeyGetTypeID() -> CFTypeID`](https://developer.apple.com/documentation/security/seckeygettypeid())

Returns the unique identifier of the opaque type to which a key object belongs.

### [Key Generation](https://developer.apple.com/documentation/security/keys\#Key-Generation)

[Generating New Cryptographic Keys](https://developer.apple.com/documentation/security/generating-new-cryptographic-keys)

Create both asymmetric and symmetric cryptographic keys.

[Protecting keys with the Secure Enclave](https://developer.apple.com/documentation/security/protecting-keys-with-the-secure-enclave)

Create an extra layer of security for your private keys.

[`func SecKeyCreateRandomKey(CFDictionary, UnsafeMutablePointer<Unmanaged<CFError>?>?) -> SecKey?`](https://developer.apple.com/documentation/security/seckeycreaterandomkey(_:_:))

Generates a new public-private key pair.

[`func SecKeyCopyPublicKey(SecKey) -> SecKey?`](https://developer.apple.com/documentation/security/seckeycopypublickey(_:))

Gets the public key associated with the given private key.

[API Reference\\
Key Generation Attributes](https://developer.apple.com/documentation/security/key-generation-attributes)

Use attribute dictionary keys during cryptographic key generation.

### [Examining Keys](https://developer.apple.com/documentation/security/keys\#Examining-Keys)

[`func SecKeyIsAlgorithmSupported(SecKey, SecKeyOperationType, SecKeyAlgorithm) -> Bool`](https://developer.apple.com/documentation/security/seckeyisalgorithmsupported(_:_:_:))

Returns a Boolean indicating whether a key is suitable for an operation using a certain algorithm.

[`func SecKeyGetBlockSize(SecKey) -> Int`](https://developer.apple.com/documentation/security/seckeygetblocksize(_:))

Gets the block length associated with a cryptographic key.

[`func SecKeyCopyAttributes(SecKey) -> CFDictionary?`](https://developer.apple.com/documentation/security/seckeycopyattributes(_:))

Gets the attributes of a given key.

[`struct SecKeyAlgorithm`](https://developer.apple.com/documentation/security/seckeyalgorithm)

The algorithms that cryptographic keys enable.

[`enum SecKeyOperationType`](https://developer.apple.com/documentation/security/seckeyoperationtype)

The types of operations that you can use a cryptographic key to perform.

### [Import and Export](https://developer.apple.com/documentation/security/keys\#Import-and-Export)

[Storing Keys as Data](https://developer.apple.com/documentation/security/storing-keys-as-data)

Create an external representation of a key for transmission.

[`func SecKeyCopyExternalRepresentation(SecKey, UnsafeMutablePointer<Unmanaged<CFError>?>?) -> CFData?`](https://developer.apple.com/documentation/security/seckeycopyexternalrepresentation(_:_:))

Returns an external representation of the given key suitable for the key’s type.

[`func SecKeyCreateWithData(CFData, CFDictionary, UnsafeMutablePointer<Unmanaged<CFError>?>?) -> SecKey?`](https://developer.apple.com/documentation/security/seckeycreatewithdata(_:_:_:))

Restores a key from an external representation of that key.

### [Key Exchange](https://developer.apple.com/documentation/security/keys\#Key-Exchange)

[`func SecKeyCopyKeyExchangeResult(SecKey, SecKeyAlgorithm, SecKey, CFDictionary, UnsafeMutablePointer<Unmanaged<CFError>?>?) -> CFData?`](https://developer.apple.com/documentation/security/seckeycopykeyexchangeresult(_:_:_:_:_:))

Performs the Diffie-Hellman style of key exchange with optional key-derivation steps.

[`struct SecKeyKeyExchangeParameter`](https://developer.apple.com/documentation/security/seckeykeyexchangeparameter)

The dictionary keys used to specify Diffie-Hellman key exchange parameters.

### [Encryption](https://developer.apple.com/documentation/security/keys\#Encryption)

[Using Keys for Encryption](https://developer.apple.com/documentation/security/using-keys-for-encryption)

Perform asymmetric and symmetric encryption and decryption using cryptographic keys.

[`func SecKeyCreateEncryptedData(SecKey, SecKeyAlgorithm, CFData, UnsafeMutablePointer<Unmanaged<CFError>?>?) -> CFData?`](https://developer.apple.com/documentation/security/seckeycreateencrypteddata(_:_:_:_:))

Encrypts a block of data using a public key and specified algorithm.

[`func SecKeyCreateDecryptedData(SecKey, SecKeyAlgorithm, CFData, UnsafeMutablePointer<Unmanaged<CFError>?>?) -> CFData?`](https://developer.apple.com/documentation/security/seckeycreatedecrypteddata(_:_:_:_:))

Decrypts a block of data using a private key and specified algorithm.

### [Digital Signatures](https://developer.apple.com/documentation/security/keys\#Digital-Signatures)

[Signing and Verifying](https://developer.apple.com/documentation/security/signing-and-verifying)

Create and evaluate digital signatures to establish the validity of code or data.

[`func SecKeyCreateSignature(SecKey, SecKeyAlgorithm, CFData, UnsafeMutablePointer<Unmanaged<CFError>?>?) -> CFData?`](https://developer.apple.com/documentation/security/seckeycreatesignature(_:_:_:_:))

Creates the cryptographic signature for a block of data using a private key and specified algorithm.

[`func SecKeyVerifySignature(SecKey, SecKeyAlgorithm, CFData, CFData, UnsafeMutablePointer<Unmanaged<CFError>?>?) -> Bool`](https://developer.apple.com/documentation/security/seckeyverifysignature(_:_:_:_:_:))

Verifies the cryptographic signature of a block of data using a public key and specified algorithm.

### [Legacy iOS Key Operations](https://developer.apple.com/documentation/security/keys\#Legacy-iOS-Key-Operations)

[`func SecKeyGeneratePair(CFDictionary, UnsafeMutablePointer<SecKey?>?, UnsafeMutablePointer<SecKey?>?) -> OSStatus`](https://developer.apple.com/documentation/security/seckeygeneratepair(_:_:_:))

Creates an asymmetric key pair.

Deprecated

[`func SecKeyEncrypt(SecKey, SecPadding, UnsafePointer<UInt8>, Int, UnsafeMutablePointer<UInt8>, UnsafeMutablePointer<Int>) -> OSStatus`](https://developer.apple.com/documentation/security/seckeyencrypt(_:_:_:_:_:_:))

Encrypts a block of plaintext.

Deprecated

[`func SecKeyDecrypt(SecKey, SecPadding, UnsafePointer<UInt8>, Int, UnsafeMutablePointer<UInt8>, UnsafeMutablePointer<Int>) -> OSStatus`](https://developer.apple.com/documentation/security/seckeydecrypt(_:_:_:_:_:_:))

Decrypts a block of ciphertext.

Deprecated

[`func SecKeyRawSign(SecKey, SecPadding, UnsafePointer<UInt8>, Int, UnsafeMutablePointer<UInt8>, UnsafeMutablePointer<Int>) -> OSStatus`](https://developer.apple.com/documentation/security/seckeyrawsign(_:_:_:_:_:_:))

Generates a digital signature for a block of data.

Deprecated

[`func SecKeyRawVerify(SecKey, SecPadding, UnsafePointer<UInt8>, Int, UnsafePointer<UInt8>, Int) -> OSStatus`](https://developer.apple.com/documentation/security/seckeyrawverify(_:_:_:_:_:_:))

Verifies a digital signature.

Deprecated

[`struct SecPadding`](https://developer.apple.com/documentation/security/secpadding)

The types of padding to use when you create or verify a digital signature.

Deprecated

### [Legacy macOS Key Operations](https://developer.apple.com/documentation/security/keys\#Legacy-macOS-Key-Operations)

[`func SecKeyGeneratePairAsync(CFDictionary, dispatch_queue_t, SecKeyGeneratePairBlock)`](https://developer.apple.com/documentation/security/seckeygeneratepairasync(_:_:_:))

Generates a public/private key pair.

Deprecated

[`func SecKeyGenerateSymmetric(CFDictionary, UnsafeMutablePointer<Unmanaged<CFError>?>?) -> SecKey?`](https://developer.apple.com/documentation/security/seckeygeneratesymmetric(_:_:))

Generates a random symmetric key.

Deprecated

[`func SecKeyCreateFromData(CFDictionary, CFData, UnsafeMutablePointer<Unmanaged<CFError>?>?) -> SecKey?`](https://developer.apple.com/documentation/security/seckeycreatefromdata(_:_:_:))

Constructs a SecKeyRef object for a symmetric key.

Deprecated

[`func SecKeyDeriveFromPassword(CFString, CFDictionary, UnsafeMutablePointer<Unmanaged<CFError>?>?) -> SecKey?`](https://developer.apple.com/documentation/security/seckeyderivefrompassword(_:_:_:))

Returns a key object in which the key data is derived from a password.

Deprecated

[`func SecKeyWrapSymmetric(SecKey, SecKey, CFDictionary, UnsafeMutablePointer<Unmanaged<CFError>?>?) -> CFData?`](https://developer.apple.com/documentation/security/seckeywrapsymmetric(_:_:_:_:))

Wraps a symmetric key with another key.

Deprecated

[`func SecKeyUnwrapSymmetric(UnsafeMutablePointer<Unmanaged<CFData>?>, SecKey, CFDictionary, UnsafeMutablePointer<Unmanaged<CFError>?>?) -> SecKey?`](https://developer.apple.com/documentation/security/seckeyunwrapsymmetric(_:_:_:_:))

Unwraps a wrapped symmetric key.

Deprecated

[`enum SecKeySizes`](https://developer.apple.com/documentation/security/seckeysizes)

The supported sizes for keys of various common types.

Deprecated

[`struct SecKeyUsage`](https://developer.apple.com/documentation/security/seckeyusage)

The flags that indicate key usage in the `KeyUsage` extension of a certificate.

[`typealias SecPublicKeyHash`](https://developer.apple.com/documentation/security/secpublickeyhash)

A container for a 20-byte public key hash.

[`typealias SecKeyGeneratePairBlock`](https://developer.apple.com/documentation/security/seckeygeneratepairblock)

A block called with the results of a call to [`SecKeyGeneratePairAsync(_:_:_:)`](https://developer.apple.com/documentation/security/seckeygeneratepairasync(_:_:_:)).

[`enum SecCredentialType`](https://developer.apple.com/documentation/security/seccredentialtype)

The credential type to be returned by [`SecKeyGetCredentials`](https://developer.apple.com/documentation/security/seckeygetcredentials).

Deprecated
