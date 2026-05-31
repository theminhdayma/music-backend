import { Body, Controller, Post } from '@nestjs/common';
import { GenerateRemixDto } from './dto/generate-remix.dto';
import { RemixService } from './remix.service';

@Controller('music/remix')
export class RemixController {
  constructor(private readonly remixService: RemixService) {}

  @Post('generate')
  async generate(
    @Body() dto: GenerateRemixDto,
  ): Promise<Record<string, unknown> | { raw: string }> {
    return this.remixService.generateRemix(dto);
  }
}
