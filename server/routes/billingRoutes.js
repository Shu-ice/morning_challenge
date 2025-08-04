import express from 'express';
import Stripe from 'stripe';
import User from '../models/User.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET || 'sk_test_dummy_key_for_development');

router.post('/create-checkout-session', protect, async (req, res) => {
  try {
    const { tier } = req.body;
    
    if (!['TAKE', 'MATSU'].includes(tier)) {
      return res.status(400).json({ error: 'INVALID_TIER' });
    }
    
    const priceId = tier === 'MATSU' 
      ? process.env.STRIPE_PRICE_MATSU 
      : process.env.STRIPE_PRICE_TAKE;
    
    if (!priceId) {
      return res.status(500).json({ error: 'PRICE_NOT_CONFIGURED' });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: req.user.email,
      line_items: [{ 
        price: priceId, 
        quantity: 1 
      }],
      success_url: `${process.env.APP_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.APP_URL}/billing/cancel`,
      metadata: { 
        userId: String(req.user._id), 
        tier 
      }
    });
    
    res.json({ url: session.url });
  } catch (error) {
    console.error('Stripe checkout error:', error);
    res.status(500).json({ error: 'CHECKOUT_ERROR' });
  }
});

router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  
  try {
    event = stripe.webhooks.constructEvent(
      req.body, 
      sig, 
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const userId = session.metadata.userId;
      const tier = session.metadata.tier;
      
      const user = await User.findById(userId);
      if (user) {
        user.membershipTier = tier;
        user.stripeCustomerId = session.customer;
        user.stripeSubscriptionId = session.subscription;
        await user.save();
      }
    }
    
    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object;
      const user = await User.findOne({ 
        stripeSubscriptionId: subscription.id 
      });
      
      if (user) {
        user.membershipTier = 'UME';
        user.stripeSubscriptionId = null;
        await user.save();
      }
    }
    
    res.json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: 'WEBHOOK_PROCESSING_ERROR' });
  }
});

router.get('/portal', protect, async (req, res) => {
  try {
    if (!req.user.stripeCustomerId) {
      return res.status(400).json({ error: 'NO_SUBSCRIPTION' });
    }
    
    const session = await stripe.billingPortal.sessions.create({
      customer: req.user.stripeCustomerId,
      return_url: `${process.env.APP_URL}/profile`
    });
    
    res.json({ url: session.url });
  } catch (error) {
    console.error('Portal session error:', error);
    res.status(500).json({ error: 'PORTAL_ERROR' });
  }
});

export default router;