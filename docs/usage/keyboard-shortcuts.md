# Keyboard shortcuts

[← Documentation](../README.md)

| Shortcut                   | Action                                                                                                       |
| -------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `Ctrl K`                   | Palette: search the whole vault and copy (`↵` password, `Shift ↵` username, `Ctrl ↵` TOTP, `Alt ↵` show) |
| `Ctrl F`                   | Filter the list                                                                                              |
| `↑` `↓` / `Enter`          | Browse / copy the main value                                                                                 |
| `Ctrl V`                   | Auto-type the selected item into the previous window                                                         |
| `Ctrl Shift C` / `U` / `O` | Copy the password / username / TOTP code of the selected item                                                |
| `Ctrl G`                   | Password generator (in a password field of the editor: generate a password into that field)                 |
| `Ctrl N`                   | New item: then `L` login, `N` secure note, `C` card, `I` identity, `S` SSH key                               |
| `Ctrl E` / `F2`            | Edit the selected item                                                                                       |
| `Ctrl S`                   | Save the item in the editor                                                                                  |
| `Ctrl Enter`               | In the SSH key editor: convert the pasted private key                                                        |
| `Esc`                      | Close the editor (asks before discarding changes)                                                            |
| `Del`                      | Move the selected item to the trash (undo in the notification)                                               |
| `Ctrl D`                   | Add the selected item to the favorites, or remove it                                                         |
| `Ctrl M`                   | Move the selected item to a folder                                                                           |
| `F5` / `Ctrl R`            | Sync                                                                                                         |
| `Ctrl L`                   | Lock                                                                                                         |
| `Ctrl ,`                   | Settings                                                                                                     |

`Ctrl E`, `F2`, `Del`, `Ctrl D` and `Ctrl M` act on the selected item of the vault: they are disabled while the editor is open and in text fields, where the keys keep their usual meaning. See [Editing items](editing.md).
