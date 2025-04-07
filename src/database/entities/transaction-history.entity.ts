import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Transaction } from './transaction.entity';

/**
 * Сущность для хранения истории изменений транзакций
 */
@Entity('transaction_history')
export class TransactionHistory {
  /**
   * Уникальный идентификатор записи истории
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Хеш транзакции, к которой относится запись
   */
  @Column({ type: 'varchar', length: 64 })
  @Index()
  transactionHash: string;

  /**
   * Предыдущий статус транзакции
   */
  @Column({ type: 'varchar', length: 20, nullable: true })
  previousStatus: string | null;

  /**
   * Новый статус транзакции
   */
  @Column({ type: 'varchar', length: 20 })
  newStatus: string;

  /**
   * Действие, которое вызвало изменение
   */
  @Column({ type: 'varchar', length: 50 })
  action: string;

  /**
   * Дополнительные данные (в JSON)
   */
  @Column({ type: 'json', nullable: true })
  data: Record<string, unknown> | null;

  /**
   * Сообщение (например, ошибки или информационное)
   */
  @Column({ type: 'text', nullable: true })
  message: string | null;

  /**
   * Дата создания записи
   */
  @CreateDateColumn()
  createdAt: Date;

  /**
   * Связь с транзакцией
   */
  @ManyToOne(() => Transaction, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'transactionHash', referencedColumnName: 'hash' })
  transaction: Transaction;
} 