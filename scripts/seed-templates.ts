import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const defaultTemplates = [
  {
    name: 'DREAMIT',
    displayName: 'DreamIT',
    primaryColor: '#0C4A6E', // Bleu DreamIT
    secondaryColor: '#0EA5E9',
    config: JSON.stringify({
      website: 'www.dreamit-astek.fr',
      headerStyle: 'logo-left-initials-right',
      sections: [
        'initials',
        'title',
        'keySkills',
        'bio',
        'competences',
        'experience',
        'formations',
        'certifications',
        'projetsPersonnels',
        'langues',
      ],
      fonts: {
        title: 'Arial',
        body: 'Arial',
      },
    }),
  },
  {
    name: 'RUPTURAE',
    displayName: 'Rupturae',
    primaryColor: '#7C3AED',
    secondaryColor: '#A78BFA',
    config: JSON.stringify({
      website: 'www.rupturae.com',
      headerStyle: 'logo-left-initials-right',
      sections: [
        'initials',
        'title',
        'keySkills',
        'bio',
        'competences',
        'experience',
        'formations',
        'certifications',
        'projetsPersonnels',
        'langues',
      ],
      fonts: {
        title: 'Arial',
        body: 'Arial',
      },
      // Template non configuré - à compléter
      incomplete: true,
    }),
  },
];

async function main() {
  console.log('Seeding templates...');

  for (const template of defaultTemplates) {
    const existing = await prisma.template.findUnique({
      where: { name: template.name },
    });

    if (existing) {
      console.log(`  Template ${template.name} already exists, updating...`);
      await prisma.template.update({
        where: { name: template.name },
        data: template,
      });
    } else {
      console.log(`  Creating template ${template.name}...`);
      await prisma.template.create({
        data: template,
      });
    }
  }

  console.log('✅ Templates seeded!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
