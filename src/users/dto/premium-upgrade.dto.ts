
export interface PremiumUpgradeDto {
  avatarId: string;
}

export interface PremiumUpgradeResponse {
  success: boolean;
  message: string;
  user: {
    id: string;
    username: string;
    status: boolean;
    coins: number;
    premiumAvatar: {
      id: string;
      name: string;
      url: string;
      price: number;
    };
  };
}