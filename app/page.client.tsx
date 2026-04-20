'use client';

import { useRouter } from 'next/navigation';
import { Card, Link, Separator } from '@heroui/react';
import { useAuth } from '@/services/auth';
import NoSSRAvatar from '@/components/userinfo/NoSSRAvatar';
import dayjs from 'dayjs';
import { useTranslations } from 'next-intl';
import LanguageSwitcher from '@/components/LanguageSwitcher';

const useGreeting = () => {
	const t = useTranslations('home');
	const hour = dayjs().hour();
	if (hour >= 0 && hour < 5) {
		return t('greeting.lateNight');
	}
	if (hour >= 5 && hour < 7) {
		return t('greeting.dawn');
	} else if (hour >= 7 && hour < 12) {
		return t('greeting.morning');
	} else if (hour >= 12 && hour < 14) {
		return t('greeting.noon');
	} else if (hour >= 14 && hour < 18) {
		return t('greeting.afternoon');
	} else if (hour >= 18 && hour < 24) {
		return t('greeting.evening');
	}
	return t('greeting.default');
};

const Header = () => {
	const { logout } = useAuth();
	const t = useTranslations('home');
	const greeting = useGreeting();
	return (
		<div>
			<div className={'flex items-center gap-2 pb-8'}>
				<NoSSRAvatar className={'shrink-0'} />
				<Separator orientation={'vertical'} className={'h-4'} />
				<span>{greeting}</span>
				<Link
					className={'cursor-pointer flex-shrink-0'}
					onPress={() => logout()}
				>
					{t('logout')}
				</Link>
				<div className={'ml-auto'}>
					<LanguageSwitcher />
				</div>
			</div>

			<h1 className={'text-3xl font-bold pb-8'}>{t('workbench')}</h1>
		</div>
	);
};

const CardItem = () => {
	const router = useRouter();
	const t = useTranslations('home');

	const onCardItemPressed = () => {
		router.push('/course-grade-stat');
	};

	// v3 Card dropped `isPressable` — per the migration guide we wrap
	// the clickable region in a native button so the whole card still
	// behaves as a single press target. `text-left` + `w-full` preserve
	// the previous flex layout; the card itself no longer needs the
	// press handler.
	return (
		<Card>
			<button
				type={'button'}
				className={'w-full cursor-pointer text-left'}
				onClick={onCardItemPressed}
			>
				<Card.Content>
					<div
						className={
							'rounded-[6px] bg-gray-600/10 size-[32px] flex items-center justify-center'
						}
					>
						<p className={'text-[16px]'}>🏃</p>
					</div>
					<div className={'mt-2'}>
						<h4 className='text-black font-medium text-[24px] mb-[-4px]'>
							{t('card.grade.title')}
						</h4>
						<span className='text-tiny text-gray/60 uppercase'>
							{t('card.grade.subtitle')}
						</span>
					</div>
				</Card.Content>
				<Card.Footer>
					<div className={'flex w-full justify-end'}>
						<span className={'material-icons-round justify-self-end'}>
							arrow_forward
						</span>
					</div>
				</Card.Footer>
			</button>
		</Card>
	);
};

export { Header, CardItem };
