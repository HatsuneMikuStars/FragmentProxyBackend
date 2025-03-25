import { MigrationInterface, QueryRunner } from "typeorm";

export class AddGasFields1742907695459 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Добавляем поле для комиссии за газ
        await queryRunner.query(`ALTER TABLE "transactions" ADD "gasFee" decimal(15,9)`);
        
        // Добавляем поле для суммы после вычета газа
        await queryRunner.query(`ALTER TABLE "transactions" ADD "amountAfterGas" decimal(15,9)`);
        
        // Добавляем поле для курса обмена
        await queryRunner.query(`ALTER TABLE "transactions" ADD "exchangeRate" decimal(15,9)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Удаляем поле для курса обмена
        await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "exchangeRate"`);
        
        // Удаляем поле для суммы после вычета газа
        await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "amountAfterGas"`);
        
        // Удаляем поле для комиссии за газ
        await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "gasFee"`);
    }

}
