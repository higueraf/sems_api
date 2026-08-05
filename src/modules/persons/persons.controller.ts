import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PersonsService } from './persons.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/role.enum';

@Controller('persons')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.EVALUATOR)
export class PersonsController {
  constructor(private readonly service: PersonsService) {}

  /** Busca personas por email, nombre o número de documento */
  @Get('search')
  search(@Query('q') q: string) {
    return this.service.search(q);
  }
}
