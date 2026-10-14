export interface SchemaExample {
  id: string
  name: string
  blurb: string
  source: string
  custom?: boolean
}

export const examples: SchemaExample[] = [
  {
    id: 'ecommerce',
    name: 'Shop',
    blurb: 'Sample store: customers, products, and orders. An order points at one customer and one product.',
    source: `CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  full_name VARCHAR(120),
  city VARCHAR(80),
  created_at TIMESTAMP
);

CREATE TABLE products (
  id INTEGER PRIMARY KEY,
  title VARCHAR(160) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('draft', 'active', 'archived'))
);

CREATE TABLE orders (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users (id),
  product_id INTEGER REFERENCES products (id),
  total DECIMAL(10, 2),
  note TEXT,
  created_at TIMESTAMP
);`,
  },
  {
    id: 'blog',
    name: 'Blog',
    blurb: 'Sample blog: authors, posts, and comments. A post belongs to an author, and a comment belongs to a post.',
    source: `CREATE TABLE authors (
  id UUID PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  full_name VARCHAR(120),
  bio TEXT
);

CREATE TABLE posts (
  id UUID PRIMARY KEY,
  author_id UUID NOT NULL REFERENCES authors(id),
  title VARCHAR(200) NOT NULL,
  slug VARCHAR(200),
  body TEXT,
  published BOOLEAN,
  created_at TIMESTAMP
);

CREATE TABLE comments (
  id UUID PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES posts(id),
  author_name VARCHAR(120),
  body TEXT,
  created_at TIMESTAMP
);`,
  },
  {
    id: 'saas',
    name: 'Company',
    blurb: 'Sample company: organizations and the people in them. A member belongs to one organization.',
    source: `CREATE TABLE organizations (
  id INTEGER PRIMARY KEY,
  company VARCHAR(160) NOT NULL,
  country VARCHAR(80),
  plan VARCHAR(20) CHECK (plan IN ('free', 'pro', 'enterprise')),
  created_at TIMESTAMP
);

CREATE TABLE members (
  id INTEGER PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES organizations(id),
  email VARCHAR(255) NOT NULL,
  role VARCHAR(20) CHECK (role IN ('owner', 'admin', 'member')),
  joined_at TIMESTAMP
);`,
  },
  {
    id: 'csv',
    name: 'CSV header',
    blurb: 'Column names only, for when you do not have a CREATE TABLE statement.',
    source: 'email, full_name, company, plan, city, created_at',
  },
]
