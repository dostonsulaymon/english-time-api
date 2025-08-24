import {ConfigService} from '@nestjs/config';

export type ClickRedirectParams = {
    amount: number;
    planId: string;
    userId: string;
    selectedSport?: string
};
const CLICK_URL = `https://my.click.uz`;
const BOT_URL = 'https://t.me/sportsuz_premium_bot';

export function getClickRedirectLink(params: ClickRedirectParams) {
    const configService = new ConfigService();
    const serviceId = configService.get<number>('CLICK_SERVICE_ID');
    const merchantId = configService.get<string>('CLICK_MERCHANT_ID');


    return `${CLICK_URL}/services/pay?service_id=${serviceId}&merchant_id=${merchantId}&amount=${params.amount}&transaction_param=${params.planId}&additional_param3=${params.userId}&communal_param=${params.selectedSport}&return_url=${BOT_URL}`;
}

