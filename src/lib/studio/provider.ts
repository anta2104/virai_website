/**
 * Nguồn sinh ảnh cho studio người mẫu ảo.
 *
 * Bọc sau một interface để đổi sang nhà cung cấp nhận ảnh tham chiếu (giữ đúng
 * sản phẩm) mà không chạm vào luồng job. Chọn bằng `IMAGE_PROVIDER`.
 */

export interface GenerateInput {
  prompt: string;
  /** Gợi ý kích thước; provider có thể bỏ qua */
  width?: number;
  height?: number;
}

export interface ImageProvider {
  readonly name: 'workers-ai' | 'external';
  /** Trả về bytes PNG/JPEG của một ảnh */
  generate(input: GenerateInput): Promise<Uint8Array>;
}

const FLUX_MODEL = '@cf/black-forest-labs/flux-1-schnell';

function decodeBase64(value: string): Uint8Array {
  const clean = value.replace(/^data:[^,]+,/, '');
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function streamToBytes(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

/**
 * Workers AI, model Flux 1 schnell (text-to-image).
 *
 * [Unverified] Theo `worker-configuration.d.ts` model trả `{ image: string }`
 * base64; các model Stable Diffusion cũ hơn trả stream bytes. Chưa chạy thật
 * với binding remote nên xử lý phòng thủ cả hai dạng.
 */
export function workersAiProvider(ai: Ai): ImageProvider {
  return {
    name: 'workers-ai',
    async generate(input) {
      const result = (await ai.run(FLUX_MODEL as never, {
        prompt: input.prompt.slice(0, 2000),
        steps: 6,
      } as never)) as unknown;

      if (result instanceof ReadableStream) return streamToBytes(result);
      if (result instanceof ArrayBuffer) return new Uint8Array(result);
      if (result instanceof Uint8Array) return result;
      if (result && typeof result === 'object' && 'image' in result) {
        const image = (result as { image?: unknown }).image;
        if (typeof image === 'string' && image) return decodeBase64(image);
      }
      throw new Error('Workers AI trả về định dạng ảnh không nhận ra');
    },
  };
}

/** Chỗ cắm cho nhà cung cấp ngoài (nhận ảnh sản phẩm tham chiếu). Chưa nối. */
export function externalProvider(): ImageProvider {
  return {
    name: 'external',
    async generate() {
      throw new Error('IMAGE_PROVIDER=external chưa được cấu hình nhà cung cấp');
    },
  };
}

export function pickImageProvider(env: Env): ImageProvider {
  const configured = (env.IMAGE_PROVIDER ?? 'workers-ai').trim().toLowerCase();
  if (configured === 'external') return externalProvider();
  if (!env.AI) {
    return {
      name: 'workers-ai',
      async generate() {
        throw new Error('Binding AI chưa sẵn sàng (local cần CF_REMOTE=1)');
      },
    };
  }
  return workersAiProvider(env.AI);
}
