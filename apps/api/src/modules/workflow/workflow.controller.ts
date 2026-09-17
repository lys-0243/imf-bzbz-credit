import { Controller, Get } from '@nestjs/common';

@Controller('workflow')
export class WorkflowController {
  @Get()
  scaffold() {
    return { module: 'workflow', implemented: false };
  }
}
