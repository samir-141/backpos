import 'reflect-metadata';
import { SetMetadata } from '@nestjs/common';

export const BOTICA_KEY = 'botica_id';

export const BoticaId = () => SetMetadata(BOTICA_KEY, true);
