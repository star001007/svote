CREATE DATABASE IF NOT EXISTS vote_system DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE vote_system;

-- 投票主题表
CREATE TABLE vote_topics (
    id INT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(255) NOT NULL,
    start_time DATETIME NOT NULL,
    end_time DATETIME NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 投票选项表
CREATE TABLE vote_options (
    id INT PRIMARY KEY AUTO_INCREMENT,
    topic_id INT NOT NULL,
    option_text VARCHAR(255) NOT NULL,
    vote_count BIGINT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 投票记录表
CREATE TABLE vote_records (
    id INT PRIMARY KEY AUTO_INCREMENT,
    topic_id INT NOT NULL,
    option_id INT NOT NULL,
    wallet_address VARCHAR(44) NOT NULL,
    vote_amount BIGINT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建唯一索引防止重复投票
CREATE UNIQUE INDEX unique_vote ON vote_records(topic_id, wallet_address);

-- 创建普通索引提升查询性能
CREATE INDEX idx_topic_id ON vote_options(topic_id);
CREATE INDEX idx_topic_option ON vote_records(topic_id, option_id); 