import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';


@Controller('test')
export class TestController {


    constructor(
        private prisma: PrismaService
    ) { }


    @Get()
    async test() {

        return this.prisma.$queryRaw`
 SELECT NOW()
 `;

    }

}