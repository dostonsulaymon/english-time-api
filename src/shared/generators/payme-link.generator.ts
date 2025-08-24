import {config} from "../../config";
import logger from "../../utils/logger";

export type PaymeLinkGeneratorParams = {
    planId: string;
    userId: string;
    amount: number;
    selectedSport?: string
}


const PAYME_CHECKOUT_URL = 'https://checkout.paycom.uz';

export function generatePaymeLink(params: PaymeLinkGeneratorParams): string {
    console.log(`Selected sport in generatePaymeLink: ${params.selectedSport}`);
    const merchantId = config.PAYME_MERCHANT_ID;
    const amountInTiyns = params.amount * 100;
    const paramsInString = `m=${merchantId};ac.plan_id=${params.planId};ac.user_id=${params.userId};ac.selected_sport=${params.selectedSport};a=${amountInTiyns}`;
    const encodedParams = base64Encode(paramsInString);
    return `${PAYME_CHECKOUT_URL}/${encodedParams}`;
}

function base64Encode(input: string): string {
    return Buffer.from(input).toString('base64');
}