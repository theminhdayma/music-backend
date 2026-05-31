import { Controller, Get, Param } from '@nestjs/common';
import { OwnershipService } from './ownership.service';

@Controller('music/ownership')
export class OwnershipController {
  constructor(private ownershipService: OwnershipService) {}

  @Get(':songId/graph')
  async getGraphData(@Param('songId') songId: string): Promise<any> {
    return this.ownershipService.getGraphData(songId);
  }

  @Get(':songId/ancestors')
  async getAncestors(@Param('songId') songId: string): Promise<any> {
    return this.ownershipService.getAncestors(songId);
  }

  @Get(':songId/descendants')
  async getDescendants(@Param('songId') songId: string): Promise<any> {
    return this.ownershipService.getDescendants(songId);
  }

  @Get('user/:userId')
  async getUserOwnerships(@Param('userId') userId: string): Promise<any> {
    return this.ownershipService.getUserOwnerships(userId);
  }
}
