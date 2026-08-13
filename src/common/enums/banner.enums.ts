export enum BannerPlacement {
  PROPERTIES_LEFT = 'properties_left',
  PROPERTIES_SIDEBAR = 'properties_sidebar',
  PROPERTY_DETAIL_LEFT = 'property_detail_left',
  PROPERTY_DETAIL_SIDEBAR = 'property_detail_sidebar',
  PROPERTY_DETAIL_INLINE = 'property_detail_inline',
  HOME_HERO = 'home_hero',
  HOME_MID = 'home_mid',
}

export const BANNER_PLACEMENT_LABELS: Record<BannerPlacement, string> = {
  [BannerPlacement.PROPERTIES_LEFT]: 'Danh sách tin — cột trái',
  [BannerPlacement.PROPERTIES_SIDEBAR]: 'Danh sách tin — cột phải',
  [BannerPlacement.PROPERTY_DETAIL_LEFT]: 'Chi tiết tin — cột trái',
  [BannerPlacement.PROPERTY_DETAIL_SIDEBAR]: 'Chi tiết tin — cột phải',
  [BannerPlacement.PROPERTY_DETAIL_INLINE]: 'Chi tiết tin — giữa nội dung',
  [BannerPlacement.HOME_HERO]: 'Trang chủ — hero slide',
  [BannerPlacement.HOME_MID]: 'Trang chủ — giữa trang',
};
