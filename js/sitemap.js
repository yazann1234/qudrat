import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: 'https://the-geniuses.com',
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    // ملاحظة: لا تضع الروابط التي تحتوي على # هنا لأن جوجل سيرفضها.
    // إذا قمت لاحقاً بتحويل الروابط إلى مسارات حقيقية (مثل /store و /quiz)،
    // يمكنك إضافتها هنا بهذا الشكل:
    // {
    //   url: 'https://the-geniuses.com/store',
    //   lastModified: new Date(),
    //   changeFrequency: 'weekly',
    //   priority: 0.8,
    // },
  ]
}
