# Storing Keys in the Keychain

Store and access cryptographic keys in the keychain.

## [Overview](https://developer.apple.com/documentation/security/storing-keys-in-the-keychain\#overview)

The keychain is the best place to store small secrets, like passwords and cryptographic keys. You use the functions of the keychain services API to add, retrieve, delete, or modify keychain items.

For information about storing cryptographic keys that you create with the [Apple CryptoKit](https://developer.apple.com/documentation/CryptoKit) framework, see [Storing CryptoKit Keys in the Keychain](https://developer.apple.com/documentation/CryptoKit/storing-cryptokit-keys-in-the-keychain).

### [Create a Query Dictionary](https://developer.apple.com/documentation/security/storing-keys-in-the-keychain\#Create-a-Query-Dictionary)

When you generate keys yourself, as described in [Generating New Cryptographic Keys](https://developer.apple.com/documentation/security/generating-new-cryptographic-keys), you can store them in the keychain as an implicit part of that process. If you obtain a key by some other means, you can still store it in the keychain. To do this, begin by creating a query dictionary containing and describing the item:

- [Swift](https://developer.apple.com/documentation/security/storing-keys-in-the-keychain#)
- [Objective-C](https://developer.apple.com/documentation/security/storing-keys-in-the-keychain#)

```
let key = <# a key #>
let tag = "com.example.keys.mykey".data(using: .utf8)!
let addquery: [String: Any] = [kSecClass as String: kSecClassKey,\
                               kSecAttrApplicationTag as String: tag,\
                               kSecValueRef as String: key]
```

```
SecKeyRef key = <# a key #>;
NSData* tag = [@"com.example.keys.mykey" dataUsingEncoding:NSUTF8StringEncoding];
NSDictionary* addquery = @{ (id)kSecValueRef: (__bridge id)key,
                            (id)kSecClass: (id)kSecClassKey,
                            (id)kSecAttrApplicationTag: tag,
                           };
```

This query dictionary uses the [`kSecClassKey`](https://developer.apple.com/documentation/security/ksecclasskey) value for the [`kSecClass`](https://developer.apple.com/documentation/security/ksecclass) entry to indicate a key item (as opposed to a certificate, identity, or password). You also apply an application tag that lets you distinguish the key from others when later searching for it.

### [Store the Item](https://developer.apple.com/documentation/security/storing-keys-in-the-keychain\#Store-the-Item)

Use the [`SecItemAdd(_:_:)`](https://developer.apple.com/documentation/security/secitemadd(_:_:)) function to actually store the item:

- [Swift](https://developer.apple.com/documentation/security/storing-keys-in-the-keychain#)
- [Objective-C](https://developer.apple.com/documentation/security/storing-keys-in-the-keychain#)

```
let status = SecItemAdd(addquery as CFDictionary, nil)
guard status == errSecSuccess else { throw <# an error #> }
```

```
OSStatus status = SecItemAdd((__bridge CFDictionaryRef)addquery, NULL);
if (status != errSecSuccess) { <# Handle the error #> }
else                         { <# Use the key #> }
```

### [Retrieve the Item](https://developer.apple.com/documentation/security/storing-keys-in-the-keychain\#Retrieve-the-Item)

When you want to retrieve the key, you construct another query dictionary using the same application tag:

- [Swift](https://developer.apple.com/documentation/security/storing-keys-in-the-keychain#)
- [Objective-C](https://developer.apple.com/documentation/security/storing-keys-in-the-keychain#)

```
let getquery: [String: Any] = [kSecClass as String: kSecClassKey,\
                               kSecAttrApplicationTag as String: tag,\
                               kSecAttrKeyType as String: kSecAttrKeyTypeRSA,\
                               kSecReturnRef as String: true]
```

```
NSDictionary *getquery = @{ (id)kSecClass: (id)kSecClassKey,
                            (id)kSecAttrApplicationTag: tag,
                            (id)kSecAttrKeyType: (id)kSecAttrKeyTypeRSA,
                            (id)kSecReturnRef: @YES,
                         };
```

The above dictionary indicates that the key should be of type [`kSecAttrKeyTypeRSA`](https://developer.apple.com/documentation/security/ksecattrkeytypersa), as in [Creating an Asymmetric Key Pair](https://developer.apple.com/documentation/security/generating-new-cryptographic-keys#Creating-an-Asymmetric-Key-Pair), and that it should have the tag used in that example and above. The last line says that the retrieval should return a key reference (as opposed, for example, to the actual key data).

Note

This is a simple query that doesn’t refine the search as much as you may need. For additional ways to do that, see [Refine the Search](https://developer.apple.com/documentation/security/storing-keys-in-the-keychain#Refine-the-Search) below.

You use this query with the [`SecItemCopyMatching(_:_:)`](https://developer.apple.com/documentation/security/secitemcopymatching(_:_:)) function to execute a search and populate an empty reference that you supply:

- [Swift](https://developer.apple.com/documentation/security/storing-keys-in-the-keychain#)
- [Objective-C](https://developer.apple.com/documentation/security/storing-keys-in-the-keychain#)

```
var item: CFTypeRef?
let status = SecItemCopyMatching(query as CFDictionary, &item)
guard status == errSecSuccess else { throw <# an error #> }
let key = item as! SecKey
```

```
SecKeyRef key = NULL;
OSStatus status = SecItemCopyMatching((__bridge CFDictionaryRef)getquery,
                                      (CFTypeRef *)&key);
if (status!=errSecSuccess) { <# Handle the error #> }
else                       { <# Use the key #> }

if (key) { CFRelease(key); }  // After you are done with it
```

If the call is successful, as indicated by the status result, you can then use the returned key reference to carry out cryptographic operations. In Objective-C, after you’re done with any keys that you retrieve this way, you’re responsible for freeing their memory. In Swift, the system manages the object’s memory.

### [Refine the Search](https://developer.apple.com/documentation/security/storing-keys-in-the-keychain\#Refine-the-Search)

The query in the example above doesn’t restrict the search to a particular key class (public, private, or symmetric) or to any other key characteristic. It matches only for tag and type, returning a reference to the first successful match. Unless you use unique tags for all of your keys of a given type, you might not get the key you were looking for when you run the search. That’s because only the first key that matches is returned, and that may or may not be the one you wanted.

There are several ways to deal with this. For example, you can:

- **Widen the search.** If you add the [`kSecMatchLimit`](https://developer.apple.com/documentation/security/ksecmatchlimit) entry to the query dictionary with a value of [`kSecMatchLimitAll`](https://developer.apple.com/documentation/security/ksecmatchlimitall), instead of a single key reference, [`SecItemCopyMatching(_:_:)`](https://developer.apple.com/documentation/security/secitemcopymatching(_:_:)) produces an array of key references, which you can inspect to find the key of interest.

- **Narrow the search.** If you have other attributes that distinguish your keys, such as key size or key class, add the corresponding entries to the query dictionary before conducting the search.

- **Avoid reusing tags in the first place.** Before adding a key with a given tag and type (or whatever other distinguishing characteristic you have), read existing keys from the keychain with those same characteristics. If you find a potential duplicate, either reuse the original key and skip creating a new one, create the new key using a different tag, or delete the old key using the [`SecItemDelete(_:)`](https://developer.apple.com/documentation/security/secitemdelete(_:)) function before adding a new one.
