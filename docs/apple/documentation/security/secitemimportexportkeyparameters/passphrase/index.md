# passphrase

The password to use during key import or export.

macOS 10.0+

```
var passphrase: Unmanaged<CFTypeRef>?
```

## [Discussion](https://developer.apple.com/documentation/security/secitemimportexportkeyparameters/passphrase\#Discussion)

You may specify either a [`CFString`](https://developer.apple.com/documentation/CoreFoundation/CFString) or a [`CFData`](https://developer.apple.com/documentation/CoreFoundation/CFData) instance for the passphrase. The PKCS12 format requires passwords in Unicode format, and passing in a [`CFString`](https://developer.apple.com/documentation/CoreFoundation/CFString) as the password is the surest way to meet this requirement (and ensure compatibility with other implementations). If you supply a [`CFData`](https://developer.apple.com/documentation/CoreFoundation/CFData) instance as the password for a PKCS12 export operation, the data is assumed to be in UTF8 form and converted as appropriate.

When importing or exporting keys ( [`SecKey`](https://developer.apple.com/documentation/security/seckey) objects) in one of the wrapped formats ( [`SecExternalFormat.formatWrappedOpenSSL`](https://developer.apple.com/documentation/security/secexternalformat/formatwrappedopenssl), [`SecExternalFormat.formatWrappedSSH`](https://developer.apple.com/documentation/security/secexternalformat/formatwrappedssh), or [`SecExternalFormat.formatWrappedPKCS8`](https://developer.apple.com/documentation/security/secexternalformat/formatwrappedpkcs8)) or in PKCS12 format, you must either explicitly specify the passphrase field or set the [`securePassphrase`](https://developer.apple.com/documentation/security/seckeyimportexportflags/securepassphrase) bit the flags field (to prompt the user to enter the password).
