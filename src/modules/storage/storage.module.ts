import { Module, Global } from '@nestjs/common';
import { StorageService } from './storage.service';
import { LocalFilesController } from './local-files.controller';

/**
 * Global: StorageService disponible en todos los módulos sin importar
 * explícitamente. LocalFilesController sirve archivos en modo disco local.
 */
@Global()
@Module({
  controllers: [LocalFilesController],
  providers:   [StorageService],
  exports:     [StorageService],
})
export class StorageModule {}
