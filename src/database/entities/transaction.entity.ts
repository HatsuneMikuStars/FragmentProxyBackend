import { Entity, Column, PrimaryColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

/**
 * Сущность для хранения информации о транзакциях TON
 */
@Entity('transactions')
export class Transaction {
  /**
   * Хеш транзакции - основной идентификатор
   */
  @PrimaryColumn({ type: 'varchar', length: 64 })
  hash: string;

  /**
   * Сумма транзакции в TON
   */
  @Column({ type: 'decimal', precision: 15, scale: 9, nullable: true })
  amount: number;

  /**
   * Адрес отправителя
   */
  @Column({ type: 'varchar', length: 64, nullable: true })
  @Index()
  senderAddress: string | null;

  /**
   * Комментарий к транзакции
   */
  @Column({ type: 'text', nullable: true })
  comment: string | null;

  /**
   * Имя пользователя Telegram, извлеченное из комментария
   */
  @Column({ type: 'varchar', length: 32, nullable: true })
  @Index()
  username: string | null;

  /**
   * Количество купленных звезд
   */
  @Column({ type: 'integer', nullable: true })
  starsAmount: number | null;

  /**
   * Хеш транзакции в Fragment
   */
  @Column({ type: 'varchar', length: 64, nullable: true })
  fragmentTransactionHash: string | null;

  /**
   * Статус обработки транзакции
   */
  @Column({ 
    type: 'varchar', 
    length: 20, 
    default: 'processed'
  })
  @Index()
  status: 'processed' | 'pending' | 'failed';

  /**
   * Сообщение об ошибке, если транзакция завершилась с ошибкой
   */
  @Column({ type: 'text', nullable: true })
  errorMessage: string | null;

  /**
   * Дата создания записи
   */
  @CreateDateColumn()
  createdAt: Date;

  /**
   * Дата последнего обновления записи
   */
  @UpdateDateColumn()
  updatedAt: Date;
} 