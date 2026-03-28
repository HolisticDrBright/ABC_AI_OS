import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Create demo organization
  const org = await prisma.organization.create({
    data: { name: 'Demo Real Estate Team' },
  });

  // Create admin user
  const passwordHash = await bcrypt.hash('password123', 12);
  const admin = await prisma.user.create({
    data: {
      organizationId: org.id,
      name: 'Admin User',
      email: 'admin@demo.com',
      passwordHash,
      role: 'admin',
    },
  });

  // Create sample segment
  const segment = await prisma.segment.create({
    data: {
      organizationId: org.id,
      name: 'Off-Market Sellers',
      description: 'Homeowners likely to sell off-market',
      criteriaJson: { minScore: 50, tags: ['homeowner', 'high-equity'] },
    },
  });

  // Create sample leads
  const leads = await Promise.all([
    prisma.lead.create({
      data: {
        organizationId: org.id,
        firstName: 'Sarah',
        lastName: 'Johnson',
        fullName: 'Sarah Johnson',
        email: 'sarah.j@example.com',
        phone: '+15551234567',
        company: 'Johnson Properties',
        title: 'Property Owner',
        city: 'Austin',
        state: 'TX',
        zip: '78701',
        sourceLabel: 'apollo',
        leadStatus: 'new',
        ownerUserId: admin.id,
      },
    }),
    prisma.lead.create({
      data: {
        organizationId: org.id,
        firstName: 'Michael',
        lastName: 'Chen',
        fullName: 'Michael Chen',
        email: 'mchen@example.com',
        phone: '+15559876543',
        company: 'Chen Capital',
        title: 'Real Estate Investor',
        city: 'Dallas',
        state: 'TX',
        zip: '75201',
        sourceLabel: 'referral',
        leadStatus: 'contacted',
        ownerUserId: admin.id,
      },
    }),
    prisma.lead.create({
      data: {
        organizationId: org.id,
        firstName: 'Lisa',
        lastName: 'Martinez',
        fullName: 'Lisa Martinez',
        email: 'lisa.m@example.com',
        phone: '+15555551234',
        city: 'Houston',
        state: 'TX',
        zip: '77002',
        sourceLabel: 'zillow',
        inboundSource: 'zillow_lead_form',
        leadStatus: 'new',
      },
    }),
  ]);

  // Create identities
  for (const lead of leads) {
    await prisma.leadIdentity.create({
      data: {
        leadId: lead.id,
        normalizedEmail: lead.email?.toLowerCase(),
        normalizedPhone: lead.phone?.replace(/\D/g, ''),
      },
    });
  }

  // Create scores for leads (NBA must never be empty)
  for (const lead of leads) {
    await prisma.leadScore.create({
      data: {
        leadId: lead.id,
        totalScore: 45 + Math.random() * 50,
        fitScore: 40 + Math.random() * 40,
        urgencyScore: 30 + Math.random() * 50,
        engagementScore: lead.leadStatus === 'contacted' ? 60 : 20,
        motivationScore: 35 + Math.random() * 40,
        closeProbability: 0.1 + Math.random() * 0.6,
        preferredChannel: 'sms',
        recommendedAngle: 'value_proposition',
        recommendedPersona: 'professional',
        nextBestAction: lead.leadStatus === 'contacted' ? 'send_followup_sms' : 'send_intro_sms',
        nextBestActionReason: lead.leadStatus === 'contacted'
          ? 'Lead has been contacted — continue engagement'
          : 'New lead requires initial outreach',
        urgencyLevel: 'medium',
        recommendedDelayHours: 0,
        explanationJson: { source: 'seed' },
        modelVersion: 'seed-v1',
        scoredAt: new Date(),
      },
    });
  }

  // Assign leads to segment
  for (const lead of leads) {
    await prisma.leadSegment.create({
      data: { leadId: lead.id, segmentId: segment.id },
    });
  }

  // Create sample campaign
  await prisma.campaign.create({
    data: {
      organizationId: org.id,
      name: 'Off-Market Seller Outreach v1',
      description: 'Initial outreach to potential off-market sellers in TX metro areas',
      status: 'draft',
      targetSegmentId: segment.id,
      personaMode: 'professional',
      objective: 'Book listing appointments with homeowners open to selling',
      approvalMode: 'manual',
      createdByUserId: admin.id,
    },
  });

  // Create sample playbooks
  const playbooks = [
    { name: 'Off-Market Seller Acquisition', type: 'acquisition', description: 'Outreach to likely off-market sellers' },
    { name: 'Stale Lead Reactivation', type: 'reactivation', description: 'Re-engage cold leads from CRM' },
    { name: 'Investor Deal Flow', type: 'investor', description: 'Outreach to active real estate investors' },
    { name: 'Sphere / Referral Reconnect', type: 'sphere', description: 'Reconnect with past clients and referral sources' },
  ];

  for (const pb of playbooks) {
    await prisma.playbook.create({
      data: { organizationId: org.id, ...pb },
    });
  }

  // Audit log for seed
  await prisma.auditLog.create({
    data: {
      organizationId: org.id,
      userId: admin.id,
      entityType: 'system',
      action: 'seed_completed',
      metadataJson: { leadsCreated: leads.length },
    },
  });

  console.log('Seed completed.');
  console.log(`  Organization: ${org.name} (${org.id})`);
  console.log(`  Admin: ${admin.email} / password123`);
  console.log(`  Leads: ${leads.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
