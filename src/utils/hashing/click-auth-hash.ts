import * as crypto from 'crypto';

export function clickAuthHash(): string {
    const merchantUserId = process.env.CLICK_MERCHANT_USER_ID;
    const secretKey = process.env.CLICK_SECRET;


    if (!merchantUserId || !secretKey) {
        throw new Error('MERCHANT_USER_ID and SECRET_KEY must be defined in environment variables');
    }

    const timestamp = Math.floor(Date.now() / 1000).toString();

    const digest = crypto
        .createHash('sha1')
        .update(timestamp + secretKey)
        .digest('hex');

    return `${merchantUserId}:${digest}:${timestamp}`;
}