# SecKeyImportExportFlags

The import/export parameter structure flags.

macOS 10.0+

```
struct SecKeyImportExportFlags
```

## [Overview](https://developer.apple.com/documentation/security/seckeyimportexportflags\#overview)

Use an instance of this structure to set the [`flags`](https://developer.apple.com/documentation/security/secitemimportexportkeyparameters/flags) property in the [`SecItemImportExportKeyParameters`](https://developer.apple.com/documentation/security/secitemimportexportkeyparameters) import/export structure.

## [Topics](https://developer.apple.com/documentation/security/seckeyimportexportflags\#topics)

### [Initializers](https://developer.apple.com/documentation/security/seckeyimportexportflags\#Initializers)

[`init(rawValue: UInt32)`](https://developer.apple.com/documentation/security/seckeyimportexportflags/init(rawvalue:))

Initialize a key import/export flag structure.

### [Constants](https://developer.apple.com/documentation/security/seckeyimportexportflags\#Constants)

[`static var importOnlyOne: SecKeyImportExportFlags`](https://developer.apple.com/documentation/security/seckeyimportexportflags/importonlyone)

A flag that you set to prevent importing more than one private key.

[`static var securePassphrase: SecKeyImportExportFlags`](https://developer.apple.com/documentation/security/seckeyimportexportflags/securepassphrase)

A flag that indicates the user should be prompted for a passphrase on import or export.

[`static var noAccessControl: SecKeyImportExportFlags`](https://developer.apple.com/documentation/security/seckeyimportexportflags/noaccesscontrol)

A flag that indicates imported private keys have no access object attached to them.

## [Relationships](https://developer.apple.com/documentation/security/seckeyimportexportflags\#relationships)

### [Conforms To](https://developer.apple.com/documentation/security/seckeyimportexportflags\#conforms-to)

- [`BitwiseCopyable`](https://developer.apple.com/documentation/Swift/BitwiseCopyable)
- [`Equatable`](https://developer.apple.com/documentation/Swift/Equatable)
- [`ExpressibleByArrayLiteral`](https://developer.apple.com/documentation/Swift/ExpressibleByArrayLiteral)
- [`OptionSet`](https://developer.apple.com/documentation/Swift/OptionSet)
- [`RawRepresentable`](https://developer.apple.com/documentation/Swift/RawRepresentable)
- [`Sendable`](https://developer.apple.com/documentation/Swift/Sendable)
- [`SendableMetatype`](https://developer.apple.com/documentation/Swift/SendableMetatype)
- [`SetAlgebra`](https://developer.apple.com/documentation/Swift/SetAlgebra)
