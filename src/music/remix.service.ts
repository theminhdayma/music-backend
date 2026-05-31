import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { GenerateRemixDto } from './dto/generate-remix.dto';

type RemixGenerationResult = Record<string, unknown> | { raw: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

@Injectable()
export class RemixService {
  private readonly logger = new Logger(RemixService.name);
  private readonly aiServiceUrl =
    process.env.AI_SERVICE_URL || 'http://localhost:8000';

  async generateRemix(dto: GenerateRemixDto): Promise<RemixGenerationResult> {
    const response = await fetch(`${this.aiServiceUrl}/remix/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: dto.prompt,
        style: dto.style || 'lofi',
        title: dto.title,
      }),
    });

    const responseText = await response.text();

    if (!response.ok) {
      this.logger.error(
        `AI service remix generation failed: ${response.status} ${responseText}`,
      );
      throw new BadGatewayException(
        responseText || 'AI remix generation failed',
      );
    }

    try {
      const parsed: unknown = JSON.parse(responseText);
      return isRecord(parsed) ? parsed : { raw: responseText };
    } catch {
      return { raw: responseText };
    }
  }
}
