import { Module, Global } from '@nestjs/common';
import { StorageService } from './storage.service';

/** Global: disponible en todos los módulos sin importar explícitamente */
@Global()
@Module({
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
