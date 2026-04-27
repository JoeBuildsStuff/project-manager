# ACL Authorization Keys

The operations an access control list entry applies to.

## [Topics](https://developer.apple.com/documentation/security/acl-authorization-keys\#topics)

### [Constants](https://developer.apple.com/documentation/security/acl-authorization-keys\#Constants)

[`let kSecACLAuthorizationAny: CFString`](https://developer.apple.com/documentation/security/ksecaclauthorizationany)

No restrictions. This ACL entry applies to all operations available to the caller.

[`let kSecACLAuthorizationLogin: CFString`](https://developer.apple.com/documentation/security/ksecaclauthorizationlogin)

Use for a CSP (smart card) login.

[`let kSecACLAuthorizationGenKey: CFString`](https://developer.apple.com/documentation/security/ksecaclauthorizationgenkey)

Generate a key.

[`let kSecACLAuthorizationDelete: CFString`](https://developer.apple.com/documentation/security/ksecaclauthorizationdelete)

Delete this item.

[`let kSecACLAuthorizationExportWrapped: CFString`](https://developer.apple.com/documentation/security/ksecaclauthorizationexportwrapped)

Export a wrapped (that is, encrypted) key. This tag is checked on the key being exported; in addition, the `CSSM_ACL_AUTHORIZATION_ENCRYPT` tag is checked for any key used in the wrapping operation.

[`let kSecACLAuthorizationExportClear: CFString`](https://developer.apple.com/documentation/security/ksecaclauthorizationexportclear)

Export an unencrypted key.

[`let kSecACLAuthorizationImportWrapped: CFString`](https://developer.apple.com/documentation/security/ksecaclauthorizationimportwrapped)

Import an encrypted key. This tag is checked on the key being imported; in addition, the `CSSM_ACL_AUTHORIZATION_DECRYPT` tag is checked for any key used in the unwrapping operation.

[`let kSecACLAuthorizationImportClear: CFString`](https://developer.apple.com/documentation/security/ksecaclauthorizationimportclear)

Import an unencrypted key.

[`let kSecACLAuthorizationSign: CFString`](https://developer.apple.com/documentation/security/ksecaclauthorizationsign)

Digitally sign data.

[`let kSecACLAuthorizationEncrypt: CFString`](https://developer.apple.com/documentation/security/ksecaclauthorizationencrypt)

Encrypt data.

[`let kSecACLAuthorizationDecrypt: CFString`](https://developer.apple.com/documentation/security/ksecaclauthorizationdecrypt)

Decrypt data.

[`let kSecACLAuthorizationMAC: CFString`](https://developer.apple.com/documentation/security/ksecaclauthorizationmac)

Create or verify a message authentication code.

[`let kSecACLAuthorizationDerive: CFString`](https://developer.apple.com/documentation/security/ksecaclauthorizationderive)

Derive a new key from another key.

[`let kSecACLAuthorizationKeychainCreate: CFString`](https://developer.apple.com/documentation/security/ksecaclauthorizationkeychaincreate)

Create a new keychain.

[`let kSecACLAuthorizationKeychainDelete: CFString`](https://developer.apple.com/documentation/security/ksecaclauthorizationkeychaindelete)

Delete a keychain.

[`let kSecACLAuthorizationKeychainItemRead: CFString`](https://developer.apple.com/documentation/security/ksecaclauthorizationkeychainitemread)

Read an item from a keychain.

[`let kSecACLAuthorizationKeychainItemInsert: CFString`](https://developer.apple.com/documentation/security/ksecaclauthorizationkeychainiteminsert)

Insert an item into a keychain.

[`let kSecACLAuthorizationKeychainItemModify: CFString`](https://developer.apple.com/documentation/security/ksecaclauthorizationkeychainitemmodify)

Modify an item in a keychain.

[`let kSecACLAuthorizationKeychainItemDelete: CFString`](https://developer.apple.com/documentation/security/ksecaclauthorizationkeychainitemdelete)

Delete an item from a keychain.

[`let kSecACLAuthorizationChangeACL: CFString`](https://developer.apple.com/documentation/security/ksecaclauthorizationchangeacl)

Change an access control list entry.

[`let kSecACLAuthorizationChangeOwner: CFString`](https://developer.apple.com/documentation/security/ksecaclauthorizationchangeowner)

For internal system use only. Use the `CSSM_ACL_AUTHORIZATION_CHANGE_ACL` tag for changes to owner ACL entries.

[`let kSecACLAuthorizationIntegrity: CFString`](https://developer.apple.com/documentation/security/ksecaclauthorizationintegrity)

[`let kSecACLAuthorizationPartitionID: CFString`](https://developer.apple.com/documentation/security/ksecaclauthorizationpartitionid)
