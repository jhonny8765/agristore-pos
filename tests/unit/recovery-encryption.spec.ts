import { describe, expect, it } from "vitest";
import {BACKUP_ENCRYPTION_FORMAT,decryptRecoveryBackup,encryptRecoveryBackup,isEncryptedRecoveryBackup} from "../../apps/web/lib/recovery-encryption";

const passphrase="a genuinely unique backup passphrase";
const record={version:2,archive:{id:"backup-1",part:1,parts:1},sales:[{id:"sale-1",total:5200}],pendingOperations:[]};

describe("optional versioned recovery encryption and legacy compatibility",()=>{
  it("encrypts a recovery JSON payload and restores its exact values",async()=>{
    const result=await encryptRecoveryBackup(record,passphrase);
    expect(result.format).toBe(BACKUP_ENCRYPTION_FORMAT);
    expect(isEncryptedRecoveryBackup(result)).toBe(true);
    expect(JSON.stringify(result)).not.toContain("sale-1");
    expect(await decryptRecoveryBackup(result,passphrase)).toEqual(record);
  });
  it("uses fresh salt and nonce for repeat exports",async()=>{
    const first=await encryptRecoveryBackup(record,passphrase);
    const second=await encryptRecoveryBackup(record,passphrase);
    expect(first.salt).not.toBe(second.salt);
    expect(first.iv).not.toBe(second.iv);
    expect(first.ciphertext).not.toBe(second.ciphertext);
  });
  it("rejects wrong passphrases and modified encrypted content",async()=>{
    const file=await encryptRecoveryBackup(record,passphrase);
    await expect(decryptRecoveryBackup(file,"wrong backup passphrase")).rejects.toThrow("Cannot decrypt backup");
    const changed={...file,ciphertext:(file.ciphertext[0]==="A"?"B":"A")+file.ciphertext.slice(1)};
    await expect(decryptRecoveryBackup(changed,passphrase)).rejects.toThrow("Cannot decrypt backup");
  });
  it("keeps existing unencrypted recovery files distinguishable",async()=>{
    expect(isEncryptedRecoveryBackup(record)).toBe(false);
    await expect(decryptRecoveryBackup(record,passphrase)).rejects.toThrow("Not an encrypted recovery backup");
    await expect(encryptRecoveryBackup(record,"short")).rejects.toThrow("at least 12");
  });
});
