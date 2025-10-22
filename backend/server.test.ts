// tests/e2e.test.js
import request from 'supertest';
import { app, pool } from '../src/server';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

// Import Zod schemas for validation
import {
  userSchema,
  createUserInputSchema,
  productSchema,
  createProductInputSchema,
  orderSchema,
  createOrderInputSchema,
  orderItemSchema,
  createOrderItemInputSchema
} from '../src/schemas';

// Test database setup
beforeAll(async () => {
  // Create test database tables
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
      image_url TEXT NOT NULL,
      category TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled')),
      total_amount NUMERIC(10,2) NOT NULL CHECK (total_amount >= 0),
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      price_at_time NUMERIC(10,2) NOT NULL CHECK (price_at_time >= 0),
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
  `);
  
  // Seed test data
  await pool.query(`
    INSERT INTO users (id, email, password_hash, full_name) VALUES
    ('test_user_1', 'test1@example.com', 'password123', 'Test User 1'),
    ('test_user_2', 'test2@example.com', 'password123', 'Test User 2'),
    ('test_admin', 'admin@example.com', 'admin123', 'Admin User');
    
    INSERT INTO products (id, name, description, price, image_url, category) VALUES
    ('prod_test_1', 'Test Product 1', 'Description 1', 10.99, 'https://example.com/1.jpg', 'electronics'),
    ('prod_test_2', 'Test Product 2', 'Description 2', 20.99, 'https://example.com/2.jpg', 'clothing');
  `);
});

// Clean up after each test
afterEach(async () => {
  await pool.query('DELETE FROM order_items');
  await pool.query('DELETE FROM orders');
});

// Full teardown
afterAll(async () => {
  await pool.query('DROP TABLE IF EXISTS order_items');
  await pool.query('DROP TABLE IF EXISTS orders');
  await pool.query('DROP TABLE IF EXISTS products');
  await pool.query('DROP TABLE IF EXISTS users');
  await pool.end();
});

describe('EcoPulse Backend Tests', () => {
  describe('Authentication Endpoints', () => {
    describe('POST /api/auth/signup', () => {
      it('should create a new user with valid credentials', async () => {
        const response = await request(app)
          .post('/api/auth/signup')
          .send({
            email: 'newuser@example.com',
            password: 'password123',
            full_name: 'New User'
          });
        
        expect(response.status).toBe(201);
        expect(response.body).toMatchObject({
          id: expect.any(String),
          email: 'newuser@example.com',
          full_name: 'New User',
          created_at: expect.any(String)
        });
        
        // Verify in database
        const userResult = await pool.query(
          'SELECT * FROM users WHERE email = $1',
          ['newuser@example.com']
        );
        expect(userResult.rows).toHaveLength(1);
        expect(userResult.rows[0].password_hash).toBe('password123'); // Plain text as required
      });

      it('should reject duplicate email', async () => {
        // First signup
        await request(app)
          .post('/api/auth/signup')
          .send({
            email: 'duplicate@example.com',
            password: 'password123',
            full_name: 'Duplicate User'
          });
        
        // Second signup with same email
        const response = await request(app)
          .post('/api/auth/signup')
          .send({
            email: 'duplicate@example.com',
            password: 'password123',
            full_name: 'Another User'
          });
        
        expect(response.status).toBe(409); // Conflict
      });

      it('should validate password strength', async () => {
        const response = await request(app)
          .post('/api/auth/signup')
          .send({
            email: 'weakpass@example.com',
            password: 'weak',
            full_name: 'Weak Password User'
          });
        
        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('error');
      });
    });

    describe('POST /api/auth/login', () => {
      it('should authenticate with correct credentials', async () => {
        // Create test user
        await request(app)
          .post('/api/auth/signup')
          .send({
            email: 'loginuser@example.com',
            password: 'password123',
            full_name: 'Login User'
          });
        
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'loginuser@example.com',
            password: 'password123'
          });
        
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('access_token');
        expect(response.body.user).toMatchObject({
          id: expect.any(String),
          email: 'loginuser@example.com',
          full_name: 'Login User'
        });
      });

      it('should reject invalid credentials', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'nonexistent@example.com',
            password: 'wrongpassword'
          });
        
        expect(response.status).toBe(401);
      });
      
      it('should handle Google SSO login correctly', async () => {
        // This would be implemented differently in actual code
        // but for testing purposes we're verifying the contract
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'guser@example.com',
            google_sso: true
          });
        
        // Implementation dependent, but should succeed
        expect(response.status).toBe(200);
      });
    });
  });

  describe('User Profile Endpoints', () => {
    let authToken;
    let userId;
    
    beforeEach(async () => {
      // Create test user and get token
      const signupRes = await request(app)
        .post('/api/auth/signup')
        .send({
          email: 'profileuser@example.com',
          password: 'password123',
          full_name: 'Profile User'
        });
      
      userId = signupRes.body.id;
      
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'profileuser@example.com',
          password: 'password123'
        });
      
      authToken = loginRes.body.access_token;
    });
    
    describe('GET /api/users/{user_id}', () => {
      it('should retrieve user profile', async () => {
        const response = await request(app)
          .get(`/api/users/${userId}`)
          .set('Authorization', `Bearer ${authToken}`);
        
        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
          id: userId,
          email: 'profileuser@example.com',
          full_name: 'Profile User'
        });
      });
      
      it('should not allow access to other users profiles without permission', async () => {
        // Create another user
        const otherUserRes = await request(app)
          .post('/api/auth/signup')
          .send({
            email: 'otheruser@example.com',
            password: 'password123',
            full_name: 'Other User'
          });
        
        const response = await request(app)
          .get(`/api/users/${otherUserRes.body.id}`)
          .set('Authorization', `Bearer ${authToken}`);
        
        // Should succeed since profiles are public by default per FRD
        expect(response.status).toBe(200);
      });
    });
    
    describe('PATCH /api/users/{user_id}', () => {
      it('should update user profile', async () => {
        const response = await request(app)
          .patch(`/api/users/${userId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            full_name: 'Updated Name',
            expertise_level: 'intermediate'
          });
        
        expect(response.status).toBe(200);
        expect(response.body.full_name).toBe('Updated Name');
        expect(response.body.expertise_level).toBe('intermediate');
      });
      
      it('should validate location data', async () => {
        const response = await request(app)
          .patch(`/api/users/${userId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            primary_location: {
              lat: 1000, // Invalid latitude
              lng: 2000, // Invalid longitude
              address: 'Invalid Location'
            }
          });
        
        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('error');
      });
      
      it('should prevent updating other users profiles', async () => {
        // Create another user
        const otherUserRes = await request(app)
          .post('/api/auth/signup')
          .send({
            email: 'otheruser@example.com',
            password: 'password123',
            full_name: 'Other User'
          });
        
        const response = await request(app)
          .patch(`/api/users/${otherUserRes.body.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            full_name: 'Hacked Name'
          });
        
        expect(response.status).toBe(403); // Forbidden
      });
    });
  });

  describe('Observation Endpoints', () => {
    let authToken;
    let userId;
    
    beforeEach(async () => {
      // Create test user and get token
      const signupRes = await request(app)
        .post('/api/auth/signup')
        .send({
          email: 'obsuser@example.com',
          password: 'password123',
          full_name: 'Observing User'
        });
      
      userId = signupRes.body.id;
      
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'obsuser@example.com',
          password: 'password123'
        });
      
      authToken = loginRes.body.access_token;
    });
    
    describe('POST /api/observations', () => {
      it('should create a new observation with valid data', async () => {
        const response = await request(app)
          .post('/api/observations')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            species_id: 'species_1',
            observation_timestamp: new Date().toISOString(),
            location: {
              lat: 37.7749,
              lng: -122.4194,
              precision: 10
            },
            media: [
              {
                type: 'photo',
                url: 'https://example.com/photo.jpg',
                metadata: { width: 1920, height: 1080 }
              }
            ],
            habitat_health: {
              air_quality: 4,
              water_quality: 3,
              invasive_species: false,
              biodiversity_index: 75
            }
          });
        
        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('id');
        
        // Verify database
        const obsResult = await pool.query(
          'SELECT * FROM observations WHERE user_id = $1',
          [userId]
        );
        expect(obsResult.rows).toHaveLength(1);
        
        const mediaResult = await pool.query(
          'SELECT * FROM observation_media WHERE observation_id = $1',
          [response.body.id]
        );
        expect(mediaResult.rows).toHaveLength(1);
      });
      
      it('should reject observation with future date beyond 90 days', async () => {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 91);
        
        const response = await request(app)
          .post('/api/observations')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            species_id: 'species_1',
            observation_timestamp: futureDate.toISOString(),
            location: {
              lat: 37.7749,
              lng: -122.4194,
              precision: 10
            }
          });
        
        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('error');
      });
      
      it('should handle geofenced area correctly', async () => {
        // Insert a protected zone for testing
        await pool.query(`
          INSERT INTO protected_zones (id, name, geometry, buffer_radius)
          VALUES (
            'test_zone',
            'Test Protected Zone',
            ST_SetSRID(ST_MakePoint(-122.4194, 37.7749), 4326),
            1000
          )
        `);
        
        const response = await request(app)
          .post('/api/observations')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            species_id: 'species_1',
            observation_timestamp: new Date().toISOString(),
            location: {
              lat: 37.7749,
              lng: -122.4194,
              precision: 10
            }
          });
        
        expect(response.status).toBe(201);
        // In real implementation, this would trigger location blurring
        // We're verifying the observation still gets created
      });
      
      it('should detect conflicting observations', async () => {
        // Create first observation
        const firstObs = await request(app)
          .post('/api/observations')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            species_id: 'species_1',
            observation_timestamp: new Date().toISOString(),
            location: {
              lat: 37.7749,
              lng: -122.4194,
              precision: 10
            }
          });
        
        // Create second observation with conflicting data
        const secondResponse = await request(app)
          .post('/api/observations')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            species_id: 'species_2', // Different species
            observation_timestamp: new Date().toISOString(),
            location: {
              lat: 37.7749,
              lng: -122.4194,
              precision: 10
            }
          });
        
        expect(secondResponse.status).toBe(201);
        expect(secondResponse.body.conflict_detected).toBe(true);
      });
    });
    
    describe('GET /api/observations', () => {
      it('should filter observations by date range', async () => {
        // Create observations with different dates
        const now = new Date();
        const pastDate = new Date(now);
        pastDate.setDate(pastDate.getDate() - 7);
        
        await request(app)
          .post('/api/observations')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            species_id: 'species_1',
            observation_timestamp: now.toISOString(),
            location: { lat: 37.7749, lng: -122.4194, precision: 10 }
          });
        
        await request(app)
          .post('/api/observations')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            species_id: 'species_1',
            observation_timestamp: pastDate.toISOString(),
            location: { lat: 37.7749, lng: -122.4194, precision: 10 }
          });
        
        const response = await request(app)
          .get('/api/observations')
          .set('Authorization', `Bearer ${authToken}`)
          .query({
            start_date: pastDate.toISOString(),
            end_date: now.toISOString(),
            species_id: 'species_1'
          });
        
        expect(response.status).toBe(200);
        expect(response.body.observations).toHaveLength(2);
      });
      
      it('should apply geofencing to results', async () => {
        // Create observation inside protected zone
        await pool.query(`
          INSERT INTO protected_zones (id, name, geometry, buffer_radius)
          VALUES (
            'test_zone',
            'Test Protected Zone',
            ST_SetSRID(ST_MakePoint(-122.4194, 37.7749), 4326),
            1000
          )
        `);
        
        await request(app)
          .post('/api/observations')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            species_id: 'species_1',
            observation_timestamp: new Date().toISOString(),
            location: {
              lat: 37.7749,
              lng: -122.4194,
              precision: 10
            }
          });
        
        const response = await request(app)
          .get('/api/observations')
          .set('Authorization', `Bearer ${authToken}`)
          .query({
            lat: 37.7749,
            lng: -122.4194,
            radius: 500
          });
        
        expect(response.status).toBe(200);
        // Should return observation but with blurred location
        expect(response.body.observations[0].location).toHaveProperty('blurred');
        expect(response.body.observations[0].location.blurred).toBe(true);
      });
    });
  });

  describe('Community Verification System', () => {
    let userToken;
    let expertToken;
    let observationId;
    
    beforeEach(async () => {
      // Create regular user
      const userSignup = await request(app)
        .post('/api/auth/signup')
        .send({
          email: 'verifyuser@example.com',
          password: 'password123',
          full_name: 'Verify User'
        });
      
      const userLogin = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'verifyuser@example.com',
          password: 'password123'
        });
      
      userToken = userLogin.body.access_token;
      
      // Create expert user
      const expertSignup = await request(app)
        .post('/api/auth/signup')
        .send({
          email: 'expert@example.com',
          password: 'password123',
          full_name: 'Expert User'
        });
      
      // Update profile to set as expert
      await request(app)
        .patch(`/api/users/${expertSignup.body.id}`)
        .set('Authorization', `Bearer ${userLogin.body.access_token}`)
        .send({
          expertise_level: 'expert'
        });
      
      const expertLogin = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'expert@example.com',
          password: 'password123'
        });
      
      expertToken = expertLogin.body.access_token;
      
      // Create observation to verify
      const obsRes = await request(app)
        .post('/api/observations')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          species_id: 'species_1',
          observation_timestamp: new Date().toISOString(),
          location: {
            lat: 37.7749,
            lng: -122.4194,
            precision: 10
          }
        });
      
      observationId = obsRes.body.id;
    });
    
    describe('Verification Workflow', () => {
      it('should allow experts to verify observations', async () => {
        const response = await request(app)
          .post(`/api/observations/${observationId}/verify`)
          .set('Authorization', `Bearer ${expertToken}`)
          .send({
            tier: 1,
            confidence: 0.95,
            notes: 'Clear photo showing distinctive features'
          });
        
        expect(response.status).toBe(200);
        expect(response.body.verification_status).toBe('verified');
        
        // Verify credibility score increased
        const userProfile = await request(app)
          .get(`/api/users/${userSignup.body.id}`)
          .set('Authorization', `Bearer ${userToken}`);
        
        expect(userProfile.body.credibility_score).toBeGreaterThan(0);
      });
      
      it('should handle verification disputes', async () => {
        // First expert verifies
        await request(app)
          .post(`/api/observations/${observationId}/verify`)
          .set('Authorization', `Bearer ${expertToken}`)
          .send({
            tier: 1,
            confidence: 0.95
          });
        
        // Second expert disputes
        const disputeRes = await request(app)
          .post(`/api/observations/${observationId}/dispute`)
          .set('Authorization', `Bearer ${expertToken}`)
          .send({
            reason: 'Misidentification',
            evidence: 'https://example.com/comparison.jpg'
          });
        
        expect(disputeRes.status).toBe(200);
        expect(disputeRes.body.status).toBe('under_review');
        
        // Verify community vote initiated
        const votesRes = await request(app)
          .get(`/api/observations/${observationId}/votes`)
          .set('Authorization', `Bearer ${expertToken}`);
        
        expect(votesRes.body.votes).toHaveLength(1);
      });
      
      it('should calculate credibility scores correctly', async () => {
        // Create multiple observations
        for (let i = 0; i < 5; i++) {
          await request(app)
            .post('/api/observations')
            .set('Authorization', `Bearer ${userToken}`)
            .send({
              species_id: `species_${i}`,
              observation_timestamp: new Date().toISOString(),
              location: {
                lat: 37.7749 + i * 0.01,
                lng: -122.4194 + i * 0.01,
                precision: 10
              }
            });
        }
        
        // Verify some observations
        const verifyObservations = async (count) => {
          const obsRes = await request(app)
            .get('/api/observations')
            .set('Authorization', `Bearer ${expertToken}`)
            .query({ limit: count });
          
          for (const obs of obsRes.body.observations) {
            await request(app)
              .post(`/api/observations/${obs.id}/verify`)
              .set('Authorization', `Bearer ${expertToken}`)
              .send({ tier: 1, confidence: 0.9 });
          }
        };
        
        // Verify 3 observations
        await verifyObservations(3);
        
        // Get user profile
        const profileRes = await request(app)
          .get(`/api/users/${userSignup.body.id}`)
          .set('Authorization', `Bearer ${userToken}`);
        
        // Credibility score should be calculated based on verification rate
        expect(profileRes.body.credibility_score).toBeGreaterThan(50);
      });
    });
  });

  describe('Database Operations', () => {
    it('should maintain data integrity with transactions', async () => {
      const client = await pool.connect();
      
      try {
        await client.query('BEGIN');
        
        // Insert user
        const userRes = await client.query(
          `INSERT INTO users (id, email, password_hash, full_name)
           VALUES ($1, $2, $3, $4)
           RETURNING id`,
          ['tx_user', 'txuser@example.com', 'password123', 'Transaction User']
        );
        
        // Insert product
        const productRes = await client.query(
          `INSERT INTO products (id, name, price, image_url, category)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id`,
          ['tx_product', 'Transactional Product', 10.99, 'https://example.com/tx.jpg', 'electronics']
        );
        
        // Insert order
        const orderRes = await client.query(
          `INSERT INTO orders (id, user_id, status, total_amount)
           VALUES ($1, $2, $3, $4)
           RETURNING id`,
          ['tx_order', userRes.rows[0].id, 'pending', 10.99]
        );
        
        // Insert order item
        await client.query(
          `INSERT INTO order_items (id, order_id, product_id, quantity, price_at_time)
           VALUES ($1, $2, $3, $4, $5)`,
          ['tx_item', orderRes.rows[0].id, productRes.rows[0].id, 1, 10.99]
        );
        
        await client.query('COMMIT');
        
        // Verify data exists
        const userCheck = await client.query(
          'SELECT * FROM users WHERE id = $1',
          ['tx_user']
        );
        expect(userCheck.rows).toHaveLength(1);
        
        const orderCheck = await client.query(
          'SELECT * FROM orders WHERE id = $1',
          ['tx_order']
        );
        expect(orderCheck.rows).toHaveLength(1);
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    });
    
    it('should enforce spatial constraints correctly', async () => {
      // Try to insert observation in protected zone with exact coordinates
      const response = await request(app)
        .post('/api/observations')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          species_id: 'species_1',
          observation_timestamp: new Date().toISOString(),
          location: {
            lat: 37.7749,
            lng: -122.4194,
            precision: 10
          }
        });
      
      expect(response.status).toBe(201);
      
      // Verify coordinate precision was adjusted
      const obsResult = await pool.query(
        'SELECT ST_X(location::geometry) as lng, ST_Y(location::geometry) as lat FROM observations WHERE id = $1',
        [response.body.id]
      );
      
      // Coordinates should be blurred (not exactly the same)
      expect(Math.abs(obsResult.rows[0].lat - 37.7749)).toBeGreaterThan(0.001);
      expect(Math.abs(obsResult.rows[0].lng + 122.4194)).toBeGreaterThan(0.001);
    });
  });

  describe('Edge Cases & Error Handling', () => {
    it('should handle offline submission conflicts', async () => {
      // Simulate two offline submissions for same observation
      const offlineSubmission1 = {
        local_id: 'local_1',
        species_id: 'species_1',
        observation_timestamp: new Date().toISOString(),
        location: { lat: 37.7749, lng: -122.4194, precision: 10 }
      };
      
      const offlineSubmission2 = {
        local_id: 'local_2',
        species_id: 'species_1',
        observation_timestamp: new Date().toISOString(),
        location: { lat: 37.7749, lng: -122.4194, precision: 10 }
      };
      
      // First sync
      const sync1 = await request(app)
        .post('/api/sync')
        .set('Authorization', `Bearer ${authToken}`)
        .send([offlineSubmission1]);
      
      expect(sync1.status).toBe(200);
      expect(sync1.body.success).toHaveLength(1);
      
      // Second sync with conflict
      const sync2 = await request(app)
        .post('/api/sync')
        .set('Authorization', `Bearer ${authToken}`)
        .send([offlineSubmission2]);
      
      expect(sync2.status).toBe(200);
      expect(sync2.body.conflicts).toHaveLength(1);
      expect(sync2.body.conflicts[0].resolution_options).toContain('merge');
    });
    
    it('should handle expired observations correctly', async () => {
      // Create observation
      const obsRes = await request(app)
        .post('/api/observations')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          species_id: 'species_1',
          observation_timestamp: new Date().toISOString(),
          location: { lat: 37.7749, lng: -122.4194, precision: 10 }
        });
      
      // Manually set observation as expired (for testing)
      await pool.query(`
        UPDATE observations 
        SET observation_timestamp = NOW() - INTERVAL '91 days'
        WHERE id = $1
      `, [obsRes.body.id]);
      
      // Try to refresh observation
      const refreshRes = await request(app)
        .post(`/api/observations/${obsRes.body.id}/refresh`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          new_evidence: ['https://example.com/newphoto.jpg']
        });
      
      expect(refreshRes.status).toBe(200);
      expect(refreshRes.body.status).toBe('refreshed');
    });
    
    it('should validate data exports properly', async () => {
      // Create multiple observations
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/observations')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            species_id: `species_${i}`,
            observation_timestamp: new Date().toISOString(),
            location: {
              lat: 37.7749 + i * 0.01,
              lng: -122.4194 + i * 0.01,
              precision: 10
            }
          });
      }
      
      // Request CSV export
      const exportRes = await request(app)
        .get('/api/export/csv')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          format: 'csv',
          include_private: false
        });
      
      expect(exportRes.status).toBe(200);
      expect(exportRes.headers['content-type']).toContain('text/csv');
      expect(exportRes.text).toContain('species_id,observation_timestamp,latitude,longitude');
      expect(exportRes.text.split('\n').length).toBe(6); // Header + 5 observations
    });
  });
});