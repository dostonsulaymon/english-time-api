// import * as argon from 'argon2';
// import { createHash } from 'node:crypto';
// import {Md5HashParams} from "../../payments/click/types/md5-params.type";
//
// export async function hashPwd(pwd: string) {
//     return await argon.hash(pwd);
// }
//
// export async function comparePwd(pwd: string, hash: string) {
//     return await argon.verify(pwd, hash);
// }
//
// export function generateMD5(params: Md5HashParams, algo = 'md5') {
//     const content = `${params.clickTransId}${params.serviceId}${params.secretKey}${params.merchantTransId}${params?.merchantPrepareId || ''}${params.amount}${params.action}${params.signTime}`;
//
//     const hashFunc = createHash(algo);
//     hashFunc.update(content);
//     return hashFunc.digest('hex');
// }