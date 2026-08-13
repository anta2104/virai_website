/**
 * Cho `node --test` hiểu import không đuôi file.
 *
 * Vite/Astro tự đoán `./site` → `./site.ts`, Node thì không. Thay vì bắt cả mã
 * nguồn phải viết đuôi `.ts` cho vừa lòng test, dán thêm bước đoán này chỉ lúc
 * chạy test.
 */
export async function resolve(specifier, context, next) {
  const extensionless = specifier.startsWith('.') && !/\.[cm]?[jt]sx?$/i.test(specifier);
  if (extensionless) {
    for (const candidate of [`${specifier}.ts`, `${specifier}/index.ts`]) {
      try {
        return await next(candidate, context);
      } catch {
        // thử cách viết kế tiếp
      }
    }
  }
  return next(specifier, context);
}
