export type Md5HashParams = {
    clickTransId: string;
    serviceId: number;
    secretKey: string;
    merchantTransId: string;
    merchantPrepareId?: number;
    amount: number;
    action: number;
    signTime: string;
}